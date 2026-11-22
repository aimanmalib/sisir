// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.24;

interface IQorePQC {
    function pqcVerify(bytes calldata pubkey, bytes calldata signature, bytes calldata message) external view returns (bool valid);
    function pqcKeyStatus(address account)
        external
        view
        returns (bool registered, uint8 algorithmId, bytes memory pubkey, bool possessionProven);
}

contract BothChecked {
    IQorePQC constant KEYS = IQorePQC(0x0000000000000000000000000000000000000a02);
    error NotReady();

    function requireReady(address account) public view {
        (bool registered, , , bool possessionProven) = KEYS.pqcKeyStatus(account);
        if (!registered) revert NotReady();
        if (!possessionProven) revert NotReady();
    }
}
