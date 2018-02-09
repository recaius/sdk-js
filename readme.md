Recaius client SDK for Node.js and browser
==========================================

Recaiusサービスを利用するためのNode.jsとブラウザ向けのクライアントライブラリです。

インストール
============

準備中。

ブラウザ向けには`dist/recaius.js`を使う事が出来ます


使い方
======

Node.js
-------

## ログインする

```js
const Recaius = require("recaius")
let recaius = new Recaius({
    auth: {
        machine_translation: {
            service_id: "<your_id>",
            password: "<your_password>"
        }
    }
})

recaius.auth.login()
    .then(() => {
        console.log("Successfully logined!!")
    })
    .catch(err => console.log(err))

// 試しに翻訳してみましょう
recaius.mt.translate({src_lang: 'ja', tgt_lang: 'en', query: '東芝'})
    .then(resp => {
        console.log('Translation result:', resp.data.translations[0].translatedText)
    })
```

## 音声認識する

```js
// ログイン済みだとします
const fs = require('fs')
let wav = fs.readFileSync('test.wav')
recaius.asr.recognize(wav, {model_id: 1}, {inputType: 'wave'})
    .then(results => console.log(results))  // results is a array of asr result

// create new Session for recognition
let session = recaius.asr.newSession()

// set event callbacks for "Result", "NoData", "Reject", "Failure", "SOS"
session.setCallback('Reject', () => console.log('Reject'))
session.setCallback('Failure', () => console.log('Failure'))
session.setCallback('SOS', () => console.log('SOS'))
session.setCallback('Result', obj => {
    console.log('Result:', obj)
})
session.setCallback('NoData', () => {
    console.log('NoData:', result)
    session.stop().then(() => console.log('session stoped'))
})

// utility method from wav to bytearray
let raw = recaius.asr.getRawFromWave(wav)

// now start to ASR
session.start({model_id: 1})
.then(resp => {
    // push byte streaming
    for(let i = 0; i < raw.buffer.byteLength; i += 3000) {
        let sz = Math.min((raw.buffer.byteLength - i), 3000)
        let a = new Int16Array(raw.buffer, i, sz / 2)
        session.push(a)
    }

    // flush send data
    return session.flush()
})
.then(() => {
    // checking result until NoData event will occur
    session.checkResultFor('NoData')
}).catch(e => console.log(e))
```

# 音声合成する

```js
// ログイン済みだとします

recaius.tts.getSound({plain_text: 'あしたも晴れるかな', lang: 'ja_JP', speaker_id: 'ja_JP-F0006-C53T'})
    .then(resp => {
        fs.writeFileSync('tts.wav', resp)  // recieve Buffer/ArrayBuffer object
    })

recaius.tts.getSound({phonetic_text: 'タイフ’ー ハチ∗ゴーワ,コノア’ト/ホク%トーホ’ーコーニ ススミマ∗ス%.',
                      lang: 'ja_JP', speaker_id: 'ja_JP-F0006-C53T'})
    .then(resp => {
        fs.writeFileSync('tts.wav', resp)
    })

recaius.tts.getPhoneticText({plain_text: '明日も晴れるかな', lang: 'ja_JP', speaker_id: 'ja_JP-F0006-C53T'})
    .then(resp => console.log(resp))  // => ｱｼ%ﾀ'ﾓ ﾊﾚ*ﾙｶﾅ.
```


Browser
-------

See example/index.html