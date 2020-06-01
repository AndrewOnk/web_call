import React from 'react'
import ReactDOM from 'react-dom'
import VideoCall from "./components/VideoCall";

document.addEventListener('DOMContentLoaded', () => {
  const root = document.getElementById("root");
  ReactDOM.render(<VideoCall/>, root)
})
