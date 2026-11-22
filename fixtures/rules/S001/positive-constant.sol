// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.24;

interface IQorePQC {
    function pqcVerify(bytes calldata pubkey, bytes calldata signature, bytes calldata message) external view returns (bool valid);
    function pqcKeyStatus(address account)
        external
        view
        returns (bool registered, uint8 algorithmId, bytes memory pubkey, bool possessionProven);
}

contract GuardedVault {
    IQorePQC constant PQC = IQorePQC(0x0000000000000000000000000000000000000A01); // expect S001

    function check(bytes calldata pubkey, bytes calldata sig, bytes calldata message) external view {
        require(PQC.pqcVerify(pubkey, sig, message), "bad signature");
    }
}
