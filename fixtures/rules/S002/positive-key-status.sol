// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.24;

interface IQorePQC {
    function pqcVerify(bytes calldata pubkey, bytes calldata signature, bytes calldata message) external view returns (bool valid);
    function pqcKeyStatus(address account)
        external
        view
        returns (bool registered, uint8 algorithmId, bytes memory pubkey, bool possessionProven);
}

contract KeyGate {
    function proven(address account) external view returns (bool) {
        (bool ok, bytes memory ret) = address(0x0000000000000000000000000000000000000a02).staticcall( // expect S002
            abi.encodeWithSignature("pqcKeyStatus(address)", account)
        );
        require(ok, "call failed");
        (bool registered,,, bool possessionProven) = abi.decode(ret, (bool, uint8, bytes, bool));
        return registered && possessionProven;
    }
}
