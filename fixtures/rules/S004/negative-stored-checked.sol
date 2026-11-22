// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.24;

interface IQorePQC {
    function pqcVerify(bytes calldata pubkey, bytes calldata signature, bytes calldata message) external view returns (bool valid);
    function pqcKeyStatus(address account)
        external
        view
        returns (bool registered, uint8 algorithmId, bytes memory pubkey, bool possessionProven);
}

contract StoredChecked {
    IQorePQC constant PQC = IQorePQC(0x0000000000000000000000000000000000000a01);
    address constant PQC_VERIFY = 0x0000000000000000000000000000000000000a01;

    function typed(bytes calldata pubkey, bytes calldata sig, bytes calldata message) external view returns (bool) {
        bool valid = PQC.pqcVerify(pubkey, sig, message);
        return valid;
    }

    function raw(bytes calldata pubkey, bytes calldata sig, bytes calldata message) external view returns (bool) {
        (bool ok, bytes memory out) = PQC_VERIFY.staticcall(abi.encodeCall(IQorePQC.pqcVerify, (pubkey, sig, message)));
        if (!ok || out.length < 32) return false;
        return abi.decode(out, (bool));
    }
}
