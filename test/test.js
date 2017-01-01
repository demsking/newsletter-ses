'use strict'

const fs = require('fs')
const assert = require('assert')
const AWS = require('aws-sdk')

const quota = { 
    ResponseMetadata: { RequestId: '7187fa1f-cf32-11e6-8edf-e3d56a8d0e0f' },
    Max24HourSend: Math.floor(Math.random() * 5000) + 10000,
    MaxSendRate: Math.floor(Math.random() * 30) + 50,
    SentLast24Hours: Math.floor(Math.random() * 30) + 1
}

let sending_status = true

AWS.SES = function (config) {
    return {
        getSendQuota: (options, done) =>
            done(options.success === false ? new Error('failed to get quota') : false, quota),
        sendEmail: (params, done) => 
            done(sending_status ? false : new Error('Test error'), params)
    }
}

const config = require('./test.json')
const messager = require('../lib/message').configure(config.ses)
const newsletter = require('../lib/lists').configure(config.ses)

describe('message', () => {
    describe('messager.load', () => {
        it('should load message from plain text', () => {
            const mail = messager.load(config.listMessagePlainText)
            
            assert.equal(config.listMessagePlainText.name, mail.subject)
            assert.equal(config.listMessagePlainText.message, mail.html)
            assert.equal(config.listMessagePlainText.message, mail.plain)
        })
        
        it('should load message from HTML text', () => {
            const mail = messager.load(config.listMessageHtmlText)
            
            assert.equal(messager.html.getTitle(config.listMessageHtmlText.message), mail.subject)
            assert.equal(config.listMessageHtmlText.message, mail.html)
            assert.equal(messager.html.getPlainText(config.listMessageHtmlText.message), mail.plain)
        })
        
        it('should load message from messager.html', () => {
            const mail = messager.load(config.listMessageObjectHtmlText)
            
            assert.equal(messager.html.getTitle(config.listMessageObjectHtmlText.message.html), mail.subject)
            assert.equal(config.listMessageObjectHtmlText.message.html, mail.html)
            assert.equal(messager.html.getPlainText(config.listMessageObjectHtmlText.message.html), mail.plain)
        })
        
        it('should load message from messager.html without <title>', () => {
            const mail = messager.load(config.listMessageObjectHtmlTextWithoutTitle)
            
            assert.equal(config.listMessageObjectHtmlTextWithoutTitle.name, mail.subject)
            assert.equal(config.listMessageObjectHtmlTextWithoutTitle.message.html, mail.html)
            assert.equal(messager.html.getPlainText(config.listMessageObjectHtmlTextWithoutTitle.message.html), mail.plain)
        })
        
        it('should load message from messager.plain', () => {
            const mail = messager.load(config.listMessageObjectPlainText)
            
            assert.equal(config.listMessageObjectPlainText.name, mail.subject)
            assert.equal(config.listMessageObjectPlainText.message.plain, mail.html)
            assert.equal(config.listMessageObjectPlainText.message.plain, mail.plain)
        })
        
        it('should load message from both messager.html and messager.plain', () => {
            const mail = messager.load(config.listMessageObjectHtmlPlainText)
            
            assert.equal(messager.html.getTitle(config.listMessageObjectHtmlPlainText.message.html), mail.subject)
            assert.equal(config.listMessageObjectHtmlPlainText.message.html, mail.html)
            assert.equal(config.listMessageObjectHtmlPlainText.message.plain, mail.plain)
        })
        
        it('should load message from both messager.html and messager.plain with messager.subject', () => {
            const mail = messager.load(config.listMessageObjectHtmlPlainSubject)
            
            assert.equal(config.listMessageObjectHtmlPlainSubject.message.subject, mail.subject)
            assert.equal(config.listMessageObjectHtmlPlainSubject.message.html, mail.html)
            assert.equal(config.listMessageObjectHtmlPlainSubject.message.plain, mail.plain)
        })
        
        it('should throw from missing messager.html and messager.plain', () => {
            assert.throws(() =>
                messager.load(config.listMessageThrowsMissingHtmlPlain), /list.message.html .+ list.message.plain/)
        })
        
        it('should throw from invalid list.message type', () => {
            assert.throws(() => 
                messager.load(config.listMessageThrowsInvalidMessageType), 'list.message must be an object or a string')
        })
    })
    
    describe('messager.getSendQuota', () => {
        it('should get email quota', (done) => {
            messager.getSendQuota({ success: true })
                .then((sendQuota) => {
                    assert.equal(quota, sendQuota)
                    done()
                })
        })
        
        it('should failed on getting email quota', (done) => {
            messager.getSendQuota({ success: false })
                .catch((err) => done())
        })
        
    })
    
    describe('messager.send', () => {
        it('should send email', (done) => {
            sending_status = true
            
            const mail = messager.load(config.listMessagePlainText)
            
            mail.to = config.listMessagePlainText.members
            
            messager.send(config.listMessagePlainText, mail)
                .on('sent', (err, params) => {
                    params = params || err
                    
                    assert.equal(mail.to, params.Destination.ToAddresses)
                    assert.equal(config.listMessagePlainText.name, params.Message.Subject.Data)
                    assert.equal(config.listMessagePlainText.message, params.Message.Body.Html.Data)
                    assert.equal(config.listMessagePlainText.message, params.Message.Body.Text.Data)
                    assert.equal(config.listMessagePlainText.sender, params.Source)
                    assert.equal(config.listMessagePlainText.options.Destination.CcAddresses, params.Destination.CcAddresses)
                    
                    done()
                })
        })
        
        it('should failed to send email', (done) => {
            sending_status = false
            
            const mail = messager.load(config.listMessagePlainText)
            
            mail.to = config.listMessagePlainText.members
            
            messager.send(config.listMessagePlainText, mail)
                .on('error', () => done())
        })
    })
})

describe('lists', function() {
    this.timeout(5000)
    
    const getLists = () => JSON.parse(JSON.stringify(config.lists))
    
    describe('lists.send', function() {
        it('should send lists', (done) => {
            sending_status = true
            
            newsletter.send({ success: true }, getLists())
                .on('finish', (e) => done())
        })
        
        it('should send lists with an error', (done) => {
            let error_count = 0
            
            sending_status = false
            
            newsletter.send(getLists())
                .on('error', (e) => { 
                    sending_status = true
                    
                    error_count++
                })
                .on('finish', (e) => {
                    if (error_count === 1) {
                        return done()
                    }
                    
                    done(new Error('should finish with an error ' + error_count))
                })
        })
        
        it('should not send lists (quota.error)', (done) => {
            newsletter.send({ success: false }, getLists())
                .on('quota.error', () => done())
        })
    })
})
