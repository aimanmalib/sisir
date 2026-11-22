// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.24;

contract OneOfTwo {
    address constant BRIDGE = 0x0000000000000000000000000000000000000901;
    string public receipts;

    event Sent(string tag, string note);

    // tag is checked, note is only logged and passed on to the bridge helper.
    function send(string calldata tag, string calldata note) external {
        require(bytes(tag).length > 0 && bytes(tag).length <= 32, "bad tag");
        emit Sent(tag, note);
        _bridge(bytes(note));
        _bridge(bytes(string.concat('{"tag":"', tag, '","note":"', note, '"}'))); // expect S006
    }

    function _bridge(bytes memory payload) private {
        (bool ok, bytes memory ret) = BRIDGE.call(abi.encodeWithSignature("executeCrossVMCall(uint8,string,bytes)", uint8(1), receipts, payload));
        require(ok && ret.length > 0, "bridge failed");
    }
}
