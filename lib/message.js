'use strict'

const fs = require('fs')
const path = require('path')
const AWS = require('aws-sdk')
const htmlToText = require('html-to-text')
const EventEmitter = require('events')

const CHARSET = 'UTF-8'
const WORD_WRAP = 130

const re_title = /<title>(.+)<\/title>/i
const parse_title = (html) => {
    const matches = re_title.exec(html)
    
    if (matches) {
        return matches[1]
    }
    
    return null
}

const load = (list) => {
    switch (typeof list.message) {
        case 'string':
            return {
                subject: parse_title(list.message) || list.name,
                html: list.message,
                plain: htmlToText.fromString(list.message, { wordwrap: WORD_WRAP })
            }
            
        case 'object':
            if (list.message === null || list.message instanceof Array) {
                break
            }
            
            if (list.message.html) {
                if (!list.message.plain) {
                    list.message.plain = htmlToText.fromString(list.message.html, { 
                        wordwrap: WORD_WRAP 
                    })
                }
            } else if (list.message.plain) {
                list.message.html = list.message.plain
            } else {
                throw new Error('list.message.html or list.message.plain is required')
            }
            
            if (!list.message.subject) {
                list.message.subject = parse_title(list.message.html) || list.name
            }
            
            return list.message
    }
    
    throw new Error('list.message must be an object or a string')
}

const send = (ses, list, mail) => {
    const event = new EventEmitter()
    const params = {
        Destination: {
            BccAddresses: mail.bcc || [],
            CcAddresses: mail.cc || [],
            ToAddresses: mail.to || []
        },
        Message: {
            Body: {
                Html: {
                    Data: mail.html,
                    Charset: list.charset || CHARSET
                },
                Text: {
                    Data: mail.plain,
                    Charset: list.charset || CHARSET
                }
            },
            Subject: {
                Data: mail.subject,
                Charset: list.charset || CHARSET
            }
        },
        Source: list.sender,
    }
    
    if (list.options) {
        for (let key in list.options) {
            if (!params[key] || params[key] instanceof Array) {
                params[key] = list.options[key]
            } else {
                for (let k in list.options[key]) {
                    params[key][k] = list.options[key][k]
                }
            }
        }
    }
    
    process.nextTick(() => 
        ses.sendEmail(params, (err, data) => {
            if (err) {
                return event.emit('error', err, data)
            }
            
            event.emit('sent', data)
        }))
    
    return event
}

module.exports = {
    configure(config) {
        if (!config.accessKeyId) {
            throw new Error('config.ses.accessKeyId is required')
        }
        
        if (!config.secretAccessKey) {
            throw new Error('config.ses.secretAccessKey is required')
        }
        
        if (!config.region) {
            throw new Error('config.ses.region is required')
        }
        
        const ses = new AWS.SES(config)
        
        return {
            load: load,
            send: (list, mail) => send(ses, list, mail),
            getSendQuota: (options) => new Promise((resolve, reject) => 
                ses.getSendQuota(options || {}, (err, quota) => {
                    if (err) {
                        return reject(err)
                    }
                    
                    resolve(quota)
                })),
            html: {
                getTitle: parse_title,
                getPlainText (html) {
                    return htmlToText.fromString(html, { wordwrap: WORD_WRAP })
                }
            }
        }
    }
}
