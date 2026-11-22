// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.24;

interface IQorePQC {
    function pqcVerify(bytes calldata pubkey, bytes calldata signature, bytes calldata message) external view returns (bool valid);
    function pqcKeyStatus(address account)
        external
        view
        returns (bool registered, uint8 algorithmId, bytes memory pubkey, bool possessionProven);
}

contract RegisteredOnly {
    IQorePQC constant KEYS = IQorePQC(0x0000000000000000000000000000000000000a02);
    mapping(address => bool) public members;

    function join() external {
        (bool registered, , , ) = KEYS.pqcKeyStatus(msg.sender); // expect S003
        require(registered, "no key");
        members[msg.sender] = true;
    }
}
