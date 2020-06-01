import React from 'react';
import { broadcastData, JOIN_CALL, LEAVE_CALL, EXCHANGE, ice } from './video_util.js';
import consumer from "../../channels/consumer";

class VideoCall extends React.Component{
  constructor(props){
    super(props);
    this.pcPeers = {};
    this.userId = Math.floor(Math.random() * 10000);
  }

  componentDidMount(){
    this.remoteVideoContainer = document.getElementById("remote-video-container");
    navigator.mediaDevices.getUserMedia( { audio: false, video: true })
      .then(stream => {
        this.localStream = stream;
        document.getElementById("local-video").srcObject = stream;
      })
      .catch(error => { console.log(error) });
  }

  joinCall(){
    consumer.subscriptions.create(
      { channel: "CallChannel" },
      { connected: () => {
          console.log('CONNECTED');

          broadcastData({ type: JOIN_CALL, from: this.userId });
        },
        received: data => {

          console.log("RECEIVED: ", data);

          if (data.from === this.userId) return;

          switch (data.type) {
            case JOIN_CALL:
              return this.join(data);
            case EXCHANGE:
              if (data.to !== this.userId) return;
              return this.exchange(data);
            case LEAVE_CALL:
              return this.removeUser(data);
            default:
              return;
          }
        }
      });
  }

  join(data){
    this.createPC(data.from, true)
  }

  removeUser(data){
    let video = document.getElementById(`remoteVideoContainer+${data.from}`);
    video && video.remove();

    let peers = this.pcPeers
    delete peers[data.from]
  }

  createPC(userId, offerBool){
    const pc = new RTCPeerConnection(ice);

    this.pcPeers[userId] = pc;
    this.localStream.getTracks().forEach(track => pc.addTrack(track, this.localStream));
    if (offerBool) {
      pc.createOffer().then(offer => {
        pc.setLocalDescription(offer).then(() => {
          setTimeout( ()=>{
            broadcastData({
              type: EXCHANGE,
              from: this.userId,
              to: userId,
              sdp: JSON.stringify(pc.localDescription),
            })

          }, 0);
        })
      })
    }
    pc.onicecandidate = (e) => this.peerConnectionOnicecandidate(e, userId);
    pc.ontrack = (e) => this.peerConnectionOnTrack(e, userId);
    pc.oniceconnectionstatechange = (e) => this.peerConnectionOnIceConnectionStateChange(e, userId, pc.iceConnectionState);
    return pc;
  };

  leaveCall(){
    const pcKeys = Object.keys(this.pcPeers);
    for (let i = 0; i < pcKeys.length; i++) {
      this.pcPeers[pcKeys[i]].close();
    }
    this.pcPeers = {};
    this.localStream && this.localStream.getTracks().forEach(function (track) {
      track.stop();
    })
    this.localStream = null;
    consumer.subscriptions.subscriptions = [];
    this.remoteVideoContainer.innerHTML = "";
    broadcastData({
      type: LEAVE_CALL,
      from: this.userId
    });
  }

  exchange(data) {
    let pc;
    if (this.pcPeers[data.from]) {
      pc = this.pcPeers[data.from];
    } else {
      pc = this.createPC(data.from, false);
    }
    if (data.candidate) {
      let candidate = JSON.parse(data.candidate)
      pc.addIceCandidate(new RTCIceCandidate(candidate))
    }
    if (data.sdp) {
      const sdp = JSON.parse(data.sdp);
      if (sdp && !sdp.candidate) {
        pc.setRemoteDescription(sdp).then(() => {
          if (sdp.type === 'offer') {
            pc.createAnswer().then(answer => {
              pc.setLocalDescription(answer)
                .then(() => {

                  broadcastData({
                    type: EXCHANGE,
                    from: this.userId,
                    to: data.from,
                    sdp: JSON.stringify(pc.localDescription)
                  });

                })
            })
          }
        })
      }
    }
  }

  peerConnectionOnicecandidate(e, userId) {
    broadcastData({
      type: EXCHANGE,
      from: this.userId,
      to: userId,
      sdp: JSON.stringify(e.candidate)
    })
  }

  peerConnectionOnTrack(e, userId) {
    const remoteVid = document.createElement("video");
    remoteVid.id = `remoteVideoContainer+${userId}`;
    remoteVid.autoplay = "autoplay";
    remoteVid.srcObject = e.streams[0];
    this.remoteVideoContainer.appendChild(remoteVid);
  }

  peerConnectionOnIceConnectionStateChange(e, userId, iceConnectionState) {
    if (iceConnectionState === 'disconnected') {
      broadcastData({
        type: LEAVE_CALL,
        from: userId,
      });
    }
  }

  render(){
    return(<div className="video-call">
      <div id="remote-video-container"/>
      <video id="local-video" autoPlay/>
      <button onClick={() => this.joinCall()}>Join Call</button>
      <button onClick={() => this.leaveCall()}>Leave Call</button>
    </div>)
  }
}
export default VideoCall;