#!/usr/bin/env node

'use strict'

const log = (key, message, report) => {
    console.log(`${new Date().toISOString()} - ${key} - ${message}`)
    
    if (report) {
        console.log(JSON.stringify(report, null, 2))
    }
}

const run = (config) => {
    if (!config.ses) {
        throw new Error('config.ses is required')
    }
    
    if (!config.lists) {
        throw new Error('config.lists is required')
    }
    
    if (config.batch) {
        config.lists.forEach((list) => {
            if (list.sendReportTo) {
                if (!(list.sendReportTo instanceof Array)) {
                    throw new Error('list.sendReportTo must be an array')
                }
                
                list.sendReportTo.forEach((email) => {
                    if (typeof email !== 'string') {
                        throw new Error('list.sendReportTo must be a list of emails address')
                    }
                })
            }
            
            if (!list.batch) {
                list.batch = Object.assign({}, config.batch)
            }
        })
    }
    
    const entities = { '&': '&amp;', '<': '&lt;', '>': '&gt;' }
    const re = new RegExp(Object.keys(entities).join('|'), 'g')
    const suffix = '-report'
    const report_sent_limit = 10
    
    require('../').configure(config.ses).send(config.lists)
        .on('quota.error', (e) => console.log(`Failed to get send quota`, e))
        .on('start', (e) => log(e.list.id, `Starting to send emails to ${e.list.members.length} members`))
        .on('batch', (e) => log(e.list.id, `batch ${e.iteration}/${e.cycle}`))
        .on('error', (e) => log(e.list.id, `Error when sending an email to ${e.member} (${e.time} ms)`, e.report))
        .on('sent', (e) => log(e.list.id, `Sent to ${e.member} (${e.time} ms)`))
        .on('complete', (e) => {
            log(e.list.id, `Complete (${e.time} ms)`, e.list.id.endsWith(suffix) ? null : e)
                   
            if (e.list.sendReportTo && e.list.sendReportTo.length) {
                delete e.list.quota.ResponseMetadata
                
                const sent_size = e.report.sent.length
                const subject = e.report.error.length > 0
                    ? sent_size === 0 
                        ? `An error occured when sending list ${e.list.id}`
                        : `List has been sent with ${e.report.error.length} errors, ${e.list.id}`
                    : `List has been sent successfully, ${e.list.message.subject || e.list.id}`
                
                if (sent_size > report_sent_limit) {
                    e.report.sent = e.report.sent.splice(0, report_sent_limit)
                    e.report.sent.push(`... ${sent_size - report_sent_limit} more members. See logs for the complete list`)
                }
                
                e.list.message.html = 
                    '<pre>' + 
                        e.list.message.html.trim().replace(re, (entity) => entities[entity]) +
                    '</pre>'
                e.list.message = JSON.stringify(e, null, 4)
                
                e.list.message = {
                    subject: subject,
                    html: '<html><body><pre>' + e.list.message + '</pre></body></html>',
                    plain: e.list.message
                }
                
                e.list.id += suffix
                e.list.members = e.list.sendReportTo
                
                delete e.list.sendReportTo
                
                config.lists.unshift(e.list)
            }
        })
}

if (process.argv[2]) {
    run(JSON.parse(process.argv[2]))
} else {
    let config = ""
    
    process.openStdin()
        .on('data', (chunk) => config += chunk)
        .on('end', () => run(JSON.parse(config)))
}
