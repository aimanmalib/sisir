// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {SisirLedger} from "../src/SisirLedger.sol";

/// Stand-in for the PQC Key Status precompile, etched at 0x…0a02. Keys are set per account by the test.
contract MockKeyStatus {
    struct Key {
        bool registered;
        bytes pubkey;
        bool possessionProven;
    }

    mapping(address => Key) internal keys;

    function setKey(address account, bool registered, bytes calldata pubkey, bool possessionProven) external {
        keys[account] = Key(registered, pubkey, possessionProven);
    }

    function pqcKeyStatus(address account) external view returns (bool, uint8, bytes memory, bool) {
        Key storage k = keys[account];
        return (k.registered, k.registered ? 1 : 0, k.pubkey, k.possessionProven);
    }
}

/// Precompile stand-in that answers with the three-value layout used before possession proofs existed.
contract MockKeyStatusLegacy {
    function pqcKeyStatus(address) external pure returns (bool, uint8, bytes memory) {
        return (true, 1, hex"01");
    }
}

contract SisirLedgerTest is Test {
    address internal constant PQC_KEY_STATUS = 0x0000000000000000000000000000000000000a02;

    SisirLedger internal ledger;
    MockKeyStatus internal keys = MockKeyStatus(PQC_KEY_STATUS);

    address internal ready = makeAddr("ready");
    address internal unproven = makeAddr("unproven");
    address internal keyless = makeAddr("keyless");

    bytes32 internal constant REPORT = keccak256("report");
    bytes32 internal constant SOURCE = keccak256("source");

    event Anchored(
        uint256 indexed id, address indexed account, bytes32 indexed reportHash, bytes32 sourceHash, uint16 findings
    );

    function setUp() public {
        ledger = new SisirLedger();
        vm.etch(PQC_KEY_STATUS, type(MockKeyStatus).runtimeCode);
        keys.setKey(ready, true, new bytes(2592), true);
        keys.setKey(unproven, true, new bytes(2592), false);
    }

    function test_registeredAndProvenAccountAnchors() public {
        vm.expectEmit(address(ledger));
        emit Anchored(0, ready, REPORT, SOURCE, 3);
        vm.prank(ready);
        uint256 id = ledger.anchor(REPORT, SOURCE, 3);

        assertEq(id, 0);
        assertEq(ledger.anchorCount(), 1);
        SisirLedger.Anchor memory a = ledger.anchorOf(0);
        assertEq(a.account, ready);
        assertEq(a.reportHash, REPORT);
        assertEq(a.sourceHash, SOURCE);
        assertEq(a.findings, 3);
        assertEq(a.blockNumber, block.number);
        assertEq(a.timestamp, block.timestamp);
    }

    function test_registeredWithoutProofIsRejected() public {
        vm.prank(unproven);
        vm.expectRevert(abi.encodeWithSelector(SisirLedger.NotQuantumReady.selector, unproven));
        ledger.anchor(REPORT, SOURCE, 0);
    }

    function test_accountWithoutKeyIsRejected() public {
        vm.prank(keyless);
        vm.expectRevert(abi.encodeWithSelector(SisirLedger.NotQuantumReady.selector, keyless));
        ledger.anchor(REPORT, SOURCE, 0);
    }

    function test_emptyPrecompileAnswerIsRejected() public {
        // Code that stops at once: the call succeeds and returns no data, like an inactive precompile.
        vm.etch(PQC_KEY_STATUS, hex"00");
        assertFalse(ledger.isQuantumReady(ready));
        vm.prank(ready);
        vm.expectRevert(abi.encodeWithSelector(SisirLedger.NotQuantumReady.selector, ready));
        ledger.anchor(REPORT, SOURCE, 0);
    }

    function test_missingPrecompileIsRejected() public {
        vm.etch(PQC_KEY_STATUS, "");
        assertFalse(ledger.isQuantumReady(ready));
    }

    function test_revertingPrecompileIsRejected() public {
        // PUSH0 PUSH0 REVERT
        vm.etch(PQC_KEY_STATUS, hex"5f5ffd");
        assertFalse(ledger.isQuantumReady(ready));
    }

    function test_legacyThreeValueAnswerIsRejected() public {
        vm.etch(PQC_KEY_STATUS, type(MockKeyStatusLegacy).runtimeCode);
        assertFalse(ledger.isQuantumReady(ready));
    }

    function test_emptyReportHashIsRejected() public {
        vm.prank(ready);
        vm.expectRevert(SisirLedger.EmptyReportHash.selector);
        ledger.anchor(bytes32(0), SOURCE, 0);
    }

    function test_unknownAnchorReverts() public {
        vm.expectRevert(abi.encodeWithSelector(SisirLedger.UnknownAnchor.selector, 0));
        ledger.anchorOf(0);
    }

    function test_latestIsNewestFirstAndCapped() public {
        vm.startPrank(ready);
        for (uint16 i = 1; i <= 3; i++) {
            ledger.anchor(keccak256(abi.encode(i)), SOURCE, i);
        }
        vm.stopPrank();

        SisirLedger.Anchor[] memory two = ledger.latest(2);
        assertEq(two.length, 2);
        assertEq(two[0].findings, 3);
        assertEq(two[1].findings, 2);
        assertEq(ledger.latest(10).length, 3);
        assertEq(ledger.latest(0).length, 0);
    }

    function test_latestOnEmptyLedger() public view {
        assertEq(ledger.latest(5).length, 0);
    }

    function test_ledgerHoldsNoValue() public {
        vm.deal(ready, 1 ether);
        vm.prank(ready);
        (bool ok,) = address(ledger).call{value: 1 wei}("");
        assertFalse(ok);
    }

    function testFuzz_anchorStoresExactHashes(bytes32 reportHash, bytes32 sourceHash, uint16 findings) public {
        vm.assume(reportHash != bytes32(0));
        vm.expectEmit(address(ledger));
        emit Anchored(0, ready, reportHash, sourceHash, findings);
        vm.prank(ready);
        ledger.anchor(reportHash, sourceHash, findings);

        SisirLedger.Anchor memory a = ledger.anchorOf(0);
        assertEq(a.reportHash, reportHash);
        assertEq(a.sourceHash, sourceHash);
        assertEq(a.findings, findings);
    }

    function testFuzz_onlyReadyAccountsAnchor(address account, bool registered, bool proven, uint8 keyLength) public {
        vm.assume(account != ready && account != unproven);
        keys.setKey(account, registered, new bytes(keyLength), proven);
        bool expected = registered && proven;
        assertEq(ledger.isQuantumReady(account), expected);

        vm.prank(account);
        if (!expected) vm.expectRevert(abi.encodeWithSelector(SisirLedger.NotQuantumReady.selector, account));
        ledger.anchor(REPORT, SOURCE, 1);
    }
}
