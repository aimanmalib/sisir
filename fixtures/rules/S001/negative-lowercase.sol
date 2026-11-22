// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.24;

interface IQorePQC {
    function pqcVerify(bytes calldata pubkey, bytes calldata signature, bytes calldata message) external view returns (bool valid);
    function pqcKeyStatus(address account)
        external
        view
        returns (bool registered, uint8 algorithmId, bytes memory pubkey, bool possessionProven);
}

contract LowercaseAddresses {
    IQorePQC constant PQC = IQorePQC(0x0000000000000000000000000000000000000a01);
    IQorePQC constant KEYS = IQorePQC(0x0000000000000000000000000000000000000a02);

    function ready(address account) external view returns (bool) {
        (bool registered,,, bool proven) = KEYS.pqcKeyStatus(account);
        return registered && proven;
    }
}
