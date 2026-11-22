// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.24;

interface IQorePQC {
    function pqcVerify(bytes calldata pubkey, bytes calldata signature, bytes calldata message) external view returns (bool valid);
    function pqcKeyStatus(address account)
        external
        view
        returns (bool registered, uint8 algorithmId, bytes memory pubkey, bool possessionProven);
}

contract OtherHex {
    // A checksummed address that is not a QoreChain precompile.
    address constant TREASURY = 0x5B38Da6a701c568545dCfcB03FcB875f56beddC4;
    // A short number that happens to equal a precompile address, not an address literal.
    uint16 constant RESULT_CODE = 0x0A01;

    function code() external pure returns (uint16, address) {
        return (RESULT_CODE, TREASURY);
    }
}
