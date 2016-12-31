'use strict'

const EventEmitter = require('events')
const message = require('./message')

const hrtime = (start, precision) => {
    const duration = process.hrtime(start)
    
    return (duration[0] * 1000 + duration[1] * 1e-6).toFixed(precision || 3)
}

const sendList = (event, messager, list) => {
    list.quota = list.quota || { MaxSendRate: 50 }
    list.batch = list.batch || { interval: 1000 }
    
    const mail = messager.load(list)
    const report = {
        list: list,
        mail: mail,
        sender: list.sender,
        start: new Date().toISOString(),
        end: null,
        sent: [],
        error: [],
        duration: null
    }
    
    let count = 0
    const size = list.members.length
    
    const batch = {
        list: list,
        iteration: 0,
        cycle: Math.ceil(size / list.quota.MaxSendRate) || 1
    }
    
    let globalstart;
    
    const checkIfIsComplete = () => {
        if (count === size && list.members.length === 0) {
            report.duration = hrtime(globalstart)
            report.end = new Date().toISOString()
            
            event.emit('complete', {
                list: list,
                time: report.duration,
                report: report
            })
        }
    }
    
    const next = () => {
        if (list.members.length === 0) {
            return
        }
        
        batch.members = list.members.splice(0, list.quota.MaxSendRate)
        batch.iteration++
        
        event.emit('batch', batch)
        
        batch.members.forEach((member) => {
            const start = process.hrtime()
            
            mail.to = [ member.email ]
            
            messager.send(list, mail)
                .on('sent', (data) => {
                    event.emit('sent', {
                        list: list,
                        member: member,
                        time: hrtime(start),
                        report: data
                    })
                    report.sent.push(member.email)
                    
                    count++
                    checkIfIsComplete()
                })
                .on('error', (e) => {
                    const event_report = {
                        list: list,
                        member: member,
                        time: hrtime(start),
                        report: e.stack,
                        error: e
                    }
                    
                    event.emit('error', event_report)
                    report.error.push(event_report)
                    
                    count++
                    checkIfIsComplete()
                })
        })
        
        setTimeout(next, list.batch.interval)
    }
    
    process.nextTick(() => {
        globalstart = process.hrtime()
        
        event.emit('start', report)
        
        next()
    })
}

module.exports = {
    configure(ses_config) {
        const messager = message.configure(ses_config)
        
        const instance = {
            send: (quotaOptions, lists) => {
                if (!lists) {
                    lists = quotaOptions
                    quotaOptions = {}
                }
                
                const event = new EventEmitter()
                
                process.nextTick(() =>
                    messager.getSendQuota(quotaOptions)
                        .then((quota) => {
                            lists = JSON.parse(JSON.stringify(lists))
                            
                            lists.forEach((list, i) => {
                                list.quota = quota
                                
                                if (list.members.length === 0) {
                                    lists.splice(i, 1)
                                }
                            })
                            
                            sendList(event, messager, lists.shift())
                            
                            event.on('complete', () => {
                                if (!lists.length) {
                                    return event.emit('finish')
                                }
                                
                                sendList(event, messager, lists.shift())
                            })
                        })
                        .catch((err) => event.emit('quota.error', err)))
                
                return event
            }
        }
        
        return instance
    }
}
