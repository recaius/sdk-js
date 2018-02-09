'use strict'

const fs = require('fs')

var chai = require('chai')
chai.should()
chai.use(require("chai-as-promised"))
chai.config.includeStack = true;
chai.config.showDiff = true;
chai.config.truncateThreshold = 20;

var Recaius = require('../')
var config = require('./config')

describe('Tts', function() {
    let recaius
    let speakers
    let test_speaker

    before(function() {
        recaius = new Recaius(config)
        return recaius.auth.login()
        .catch(() => {
            console.log('ログイン失敗')
            this.skip()
        })
    })

    it('話者一覧を取得できる', function() {
        return recaius.tts.getSpeakers().should.fulfilled.then(j => {
            j.should.have.all.keys('speaker')
            speakers = j.speaker
        })
    })

    it('話者が一人以上居る', function() {
        speakers.should.have.length.above(0)
        test_speaker = speakers[0]
    })

    it('プレーンテキストから音声を取得できる', function() {
        return recaius.tts.getSound({plain_text: 'AAA', lang: test_speaker.lang, speaker_id: test_speaker.speaker_id})
        .should.be.fulfilled.then(resp => {
            resp.should.be.instanceof(Buffer)
            fs.writeFileSync('tts.wav', resp)
        })
    })

    it('読み調整テキストから音声を取得できる', function() {
        let text = ''
        if(/^ja_/.test(test_speaker.lang)) {
            text = 'タイフ’ー ハチ∗ゴーワ,コノア’ト/ホク%トーホ’ーコーニ ススミマ∗ス%.'
        } else if(/^(en_|es_|de_|fr_)/.test(test_speaker.lang)) {
            text = '#P,#h@."loU -- #P.#"w@ld#E\\#'
        } else if(/^zh_/.test(test_speaker.lang)) {
            text = '#P:#jian2.suo3 dao4 fu4.jin4 de5<voice xml:lang="en_US">"sE.v@n I."lE.v@n#E\#</voice>'
        } else if(/^ko_/.test(test_speaker.lang)) {
            text = '프로축꾸 카가,-- 케마켇따.\\'
        }
        return recaius.tts.getSound({phonetic_text: text, lang: test_speaker.lang, speaker_id: test_speaker.speaker_id})
        .should.be.fulfilled.then(resp => {
            resp.should.be.instanceof(Buffer)
        })
    })

    it('プレーンテキストから読み調整テキストを取得できる', function() {
        return recaius.tts.getPhoneticText({plain_text: 'AAA', lang: test_speaker.lang, speaker_id: test_speaker.speaker_id})
        .should.be.fulfilled.then(resp => {
            resp.should.be.a('string')
        })
    })

    // TODO: ユーザー辞書登録系

    after(function() {
        return recaius.auth.logout()
    })

})

