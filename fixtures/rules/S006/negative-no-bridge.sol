// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.24;

// Concatenating a parameter is fine when the result never reaches the bridge.
contract NoBridge {
    event Greeted(string text);

    function greet(string calldata name) external returns (string memory text) {
        text = string.concat('{"hello":"', name, '"}');
        emit Greeted(text);
    }

    function label(bytes calldata raw) external pure returns (bytes memory) {
        return abi.encodePacked("label:", raw);
    }
}
