// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.24;

interface IQorePQC {
    function pqcVerify(bytes calldata pubkey, bytes calldata signature, bytes calldata message) external view returns (bool valid);
    function pqcKeyStatus(address account)
        external
        view
        returns (bool registered, uint8 algorithmId, bytes memory pubkey, bool possessionProven);
}

contract StoredUnread {
    IQorePQC constant PQC = IQorePQC(0x0000000000000000000000000000000000000a01);
    uint256 public nonce;

    function act(bytes calldata pubkey, bytes calldata sig) external {
        bool valid = PQC.pqcVerify(pubkey, sig, abi.encode(block.chainid, address(this), nonce)); // expect S004
        nonce += 1;
    }
}
