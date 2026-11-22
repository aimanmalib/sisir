// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.24;

/// @title SisirLedger
/// @notice A public record of Sisir lint reports. An account anchors the hash of a report and the hash of the
/// source it describes. Only quantum-ready accounts may anchor: the account must have an ML-DSA-87 key registered
/// on chain with a verified proof of possession, read from the PQC Key Status precompile on every call.
/// @dev No owner, no pause, no upgrade, nothing payable. A defect means a new deployment.
contract SisirLedger {
    /// PQC Key Status precompile (active on the qorechain-diana testnet).
    address internal constant PQC_KEY_STATUS = 0x0000000000000000000000000000000000000a02;

    /// Smallest valid ABI encoding of (bool, uint8, bytes, bool): four head words plus the length word of `bytes`.
    uint256 internal constant KEY_STATUS_MIN_LENGTH = 160;

    /// Where `pubkey` starts in a four-value answer. The older three-value answer puts it at 96, and its length
    /// word would otherwise be read as `possessionProven`.
    uint256 internal constant KEY_STATUS_PUBKEY_OFFSET = 128;

    struct Anchor {
        address account;
        bytes32 reportHash;
        bytes32 sourceHash;
        uint16 findings;
        uint256 blockNumber;
        uint256 timestamp;
    }

    /// Number of anchors so far. Anchor ids run from 0 to anchorCount - 1.
    uint256 public anchorCount;

    mapping(uint256 id => Anchor) private _anchors;

    event Anchored(
        uint256 indexed id, address indexed account, bytes32 indexed reportHash, bytes32 sourceHash, uint16 findings
    );

    error NotQuantumReady(address account);
    error EmptyReportHash();
    error UnknownAnchor(uint256 id);

    /// @notice Anchor a report. Reverts unless the sender has a registered, possession-proven post-quantum key.
    /// @param reportHash keccak256 of the canonical JSON report.
    /// @param sourceHash keccak256 of the linted source.
    /// @param findings Number of findings in the report.
    /// @return id The new anchor id.
    function anchor(bytes32 reportHash, bytes32 sourceHash, uint16 findings) external returns (uint256 id) {
        if (reportHash == bytes32(0)) revert EmptyReportHash();
        if (!isQuantumReady(msg.sender)) revert NotQuantumReady(msg.sender);

        id = anchorCount++;
        _anchors[id] = Anchor({
            account: msg.sender,
            reportHash: reportHash,
            sourceHash: sourceHash,
            findings: findings,
            blockNumber: block.number,
            timestamp: block.timestamp
        });
        emit Anchored(id, msg.sender, reportHash, sourceHash, findings);
    }

    /// @notice True when `account` has a registered ML-DSA-87 key with a verified proof of possession.
    /// An empty or short answer (inactive precompile) or the older three-value answer counts as not ready.
    function isQuantumReady(address account) public view returns (bool) {
        (bool ok, bytes memory ret) =
            PQC_KEY_STATUS.staticcall(abi.encodeWithSignature("pqcKeyStatus(address)", account));
        if (!ok || ret.length < KEY_STATUS_MIN_LENGTH) return false;
        // Read the head only: the pubkey offset proves the four-value layout; the key bytes are not needed here.
        (bool registered,, uint256 pubkeyOffset, bool possessionProven) = abi.decode(ret, (bool, uint8, uint256, bool));
        return pubkeyOffset == KEY_STATUS_PUBKEY_OFFSET && registered && possessionProven;
    }

    /// @notice One anchor by id.
    function anchorOf(uint256 id) external view returns (Anchor memory) {
        if (id >= anchorCount) revert UnknownAnchor(id);
        return _anchors[id];
    }

    /// @notice The most recent anchors, newest first, at most `limit` of them.
    function latest(uint256 limit) external view returns (Anchor[] memory list) {
        uint256 total = anchorCount;
        uint256 n = limit < total ? limit : total;
        list = new Anchor[](n);
        for (uint256 i = 0; i < n; i++) {
            list[i] = _anchors[total - 1 - i];
        }
    }
}
