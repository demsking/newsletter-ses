'use strict'

const EventEmitter = require('events')
const message = require('./message')

const hrtime = (start, precision) => {
    const duration = process.hrtime(start)
    
    return (duration[0] * 1000 + duration[1] * 1e-6).toFixed(precision || 3)
}

const sendList = (event, messager, list) => {
    list.quota = list.quota || {}
    list.quota.MaxSendRate = list.quota.MaxSendRate || 50
    
    list.batch = list.batch || {}
    list.batch.interval = list.batch.interval || 1000
    
    list.message = messager.load(list)
    
    const report = {
        listId: list.id,
        sender: list.sender,
        start: new Date().toISOString(),
        sent: [],
        error: []
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
            
            delete list.message.to
            delete list.members
            
            event.emit('complete', {
                time: report.duration,
                report: report,
                list: list
            })
        }
    }
    
    const next = () => {
        if (!list.members || list.members.length === 0) {
            return
        }
        
        batch.members = list.members.splice(0, list.quota.MaxSendRate)
        batch.iteration++
        
        event.emit('batch', batch)
        
        batch.members.forEach((member) => {
            const start = process.hrtime()
            
            list.message.to = [ member ]
            
            messager.send(list, list.message)
                .on('sent', (data) => {
                    event.emit('sent', {
                        time: hrtime(start),
                        member: member,
                        list: list,
                        report: data
                    })
                    report.sent.push(member)
                    
                    count++
                    checkIfIsComplete()
                })
                .on('error', (e) => {
                    const event_report = {
                        time: hrtime(start),
                        member: member,
                        report: e.stack,
                        error: e,
                        list: list
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
        
        event.emit('start', {
            report: report,
            list: list
        })
        
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
                
                if (!(lists instanceof Array)) {
                    throw new Error('config.lists must be an array')
                }
                
                lists.forEach((list, i) => {
                    if (!list.sender) {
                        throw new Error('list.sender is required')
                    }
                    
                    if (!list.members) {
                        throw new Error('list.members is required')
                    }
                    
                    if (!(list.members instanceof Array)) {
                        throw new Error('list.members must be an array')
                    }
                    
                    if (!list.message) {
                        throw new Error('list.message is required')
                    }
                    
                    list.members.forEach((member) => {
                        if (typeof member !== 'string') {
                            throw new Error('list.members must be a list of emails address')
                        }
                    })
                    
                    if (!list.id) {
                        if (list.name) {
                            list.id = list.name.replace(/\s/g, '-').toLowerCase()
                        } else {
                            list.id = 'newsletter-list-' + i
                        }
                    }
                })
                
                const event = new EventEmitter()
                
                process.nextTick(() =>
                    messager.getSendQuota(quotaOptions)
                        .then((quota) => {
                            lists.forEach((list, i) => {
                                list.quota = quota
                                
                                if (list.members.length === 0) {
                                    lists.splice(i, 1)
                                }
                            })
                            
                            sendList(event, messager, lists.shift())
                            
                            event.on('complete', (e) => {
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
