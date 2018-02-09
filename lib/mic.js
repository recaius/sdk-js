class Microphone {
    constructor() {
      this.bufferSize = 0
      this.context_ = null
      this.source_ = null
      this.scriptProcessor_ = null
    }

    setMedia_() {
      navigator.getUserMedia = navigator.getUserMedia || navigator.webkitGetUserMedia || navigator.mozGetUserMedia || navigator.msGetUserMedia;
      window.AudioContext = window.AudioContext || window.webkitAudioContext
    }

    stop() {
      return this.context_.suspend()
    }

    start() {
      return this.context_.resume()
    }

    sampleRate() {
      return this.context_.sampleRate
    }

    getMic() {
      this.setMedia_()
      return new Promise((resolve, reject) => {
        if (!navigator.getUserMedia) {
          console.log("no media")
          return reject(new Error("Your browser does not support media API"))
        }
        navigator.getUserMedia({
            video: false,
            audio: true
          },
          stream => {
            console.log(`got audio`)
            this.context_ = new AudioContext();
            this.source_ = this.context_.createMediaStreamSource(stream);
            this.scriptProcessor_ = this.context_.createScriptProcessor(this.bufferSize, 1, 1);
            this.scriptProcessor_.onaudioprocess = event => this.processInput_(event)
            this.source_.connect(this.scriptProcessor_)
            this.scriptProcessor_.connect(this.context_.destination)
            this.context_.suspend()
            resolve()
          },
          err => {
            console.log("Get mic: the following error occured: " + err);
            reject(err)
          }
        )
      })
    }

    onInput(buffer) {
      console.log("call onInput")
    }

    processInput_(event) {
      this.onInput(event.inputBuffer.getChannelData(0))
    }
  }

  export function getMic() {
    let mic = new Microphone;
    return mic.getMic().then(() => mic);
  }
