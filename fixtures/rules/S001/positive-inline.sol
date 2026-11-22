// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.24;

interface IQorePQC {
    function pqcVerify(bytes calldata pubkey, bytes calldata signature, bytes calldata message) external view returns (bool valid);
    function pqcKeyStatus(address account)
        external
        view
        returns (bool registered, uint8 algorithmId, bytes memory pubkey, bool possessionProven);
}

address constant KEYS = 0x0000000000000000000000000000000000000a02;

contract StatusProbe {
    function hasKey(address account) external view returns (bool) {
        (bool ok, bytes memory ret) = address(0x0000000000000000000000000000000000000A02) // expect S001
            .staticcall(abi.encodeWithSignature("pqcKeyStatus(address)", account));
        if (!ok || ret.length < 128) return false;
        (bool registered,,, bool proven) = abi.decode(ret, (bool, uint8, bytes, bool));
        return registered && proven;
    }
}
