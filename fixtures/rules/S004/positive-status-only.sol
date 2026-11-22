// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.24;

interface IQorePQC {
    function pqcVerify(bytes calldata pubkey, bytes calldata signature, bytes calldata message) external view returns (bool valid);
    function pqcKeyStatus(address account)
        external
        view
        returns (bool registered, uint8 algorithmId, bytes memory pubkey, bool possessionProven);
}

contract StatusOnly {
    address constant PQC_VERIFY = 0x0000000000000000000000000000000000000a01;

    function check(bytes calldata pubkey, bytes calldata sig, bytes calldata message) external view {
        (bool ok, ) = PQC_VERIFY.staticcall(abi.encodeCall(IQorePQC.pqcVerify, (pubkey, sig, message))); // expect S004
        require(ok, "verify failed");
    }
}
