// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.24;

interface IQorePQC {
    function pqcVerify(bytes calldata pubkey, bytes calldata signature, bytes calldata message) external view returns (bool valid);
    function pqcKeyStatus(address account)
        external
        view
        returns (bool registered, uint8 algorithmId, bytes memory pubkey, bool possessionProven);
}

contract ProvenUnread {
    IQorePQC constant KEYS = IQorePQC(0x0000000000000000000000000000000000000a02);
    error NoKey();

    function keyOf(address guardian) external view returns (bytes memory) {
        (bool registered,, bytes memory pubkey, bool proven) = KEYS.pqcKeyStatus(guardian); // expect S003
        if (!registered || pubkey.length == 0) revert NoKey();
        return pubkey;
    }
}
