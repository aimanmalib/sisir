// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.24;

interface IQorePQC {
    function pqcVerify(bytes calldata pubkey, bytes calldata signature, bytes calldata message) external view returns (bool valid);
    function pqcKeyStatus(address account)
        external
        view
        returns (bool registered, uint8 algorithmId, bytes memory pubkey, bool possessionProven);
}

contract DecodeTwice {
    address constant KEYS = 0x0000000000000000000000000000000000000a02;

    function keyOf(address account) external view returns (bytes memory) {
        (bool ok, bytes memory ret) = KEYS.staticcall(abi.encodeWithSignature("pqcKeyStatus(address)", account));
        require(ok && ret.length >= 128, "no answer");
        // The head alone first, to stop early on an unregistered account.
        bool registered = abi.decode(ret, (bool));
        if (!registered) return "";
        (, , bytes memory pubkey, bool proven) = abi.decode(ret, (bool, uint8, bytes, bool));
        require(proven, "possession not proven");
        return pubkey;
    }
}
