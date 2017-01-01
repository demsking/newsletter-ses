# newsletter-ses
Send newsletters using AWS SES

[![Build Status](https://travis-ci.org/demsking/newsletter-ses.svg?branch=master)](https://travis-ci.org/demsking/newsletter-ses)
[![bitHound Overall Score](https://www.bithound.io/github/demsking/newsletter-ses/badges/score.svg)](https://www.bithound.io/github/demsking/newsletter-ses)
[![bitHound Dependencies](https://www.bithound.io/github/demsking/newsletter-ses/badges/dependencies.svg)](https://www.bithound.io/github/demsking/newsletter-ses/master/dependencies/npm)

# Install
```sh
npm install --save newsletter-ses
```

# Usage

The configuration format:

```js
const config = {
    "ses": {
        "accessKeyId": "7187fa1fcf3211e6", 
        "secretAccessKey": "7187fa1f-cf32-11e6-8edf+e3d56a8d0e0", 
        "region": "eu-west-1"
    },
    "lists": [
        {
            // The optional newsletter ID
            "id": "newsletter-test-1",
            // The newsletter name. used as fallback dubject
            "name": "Newsletter Test List #1",
            // The newsletter sender (from)
            "sender": "newsletter@example.com",
            // The list for members
            "members": [
                "test1@example.com",
                "test2@example.com"
            ],
            // message to send
            "message": {
                "subject": "Hello, World",
                "html": "<p>The newsletter body in HTML</p>",
                "plain": "The newsletter body in Plain Text"
            }
        },
        {
            "id": "newsletter-test-2",
            "name": "Newsletter Test List #2",
            "sender": "newsletter@example.com",
            "members": [ "test@example.com" ],
            "message": {
                // Node the missing subject field: 
                // it will be generate from the <title> tag in the HTML content
                "html": `
                    <html>
                        <head>
                            <title>Hello, World!</title>
                        </head>
                        <body>
                            <p>The newsletter body in HTML</p>
                        </body>
                    </html>`,
                "plain": "The newsletter body in Plain Text"
            }
        },
        {
            "id": "newsletter-test-3",
            "name": "Newsletter Test List #3",
            "sender": "newsletter@example.com",
            "members": [ "test@example.com" ],
            "message": {
                "html": `
                    <html>
                        <head>
                            <title>Hello, World!</title>
                        </head>
                        <body>
                            <p>The newsletter body in HTML</p>
                        </body>
                    </html>`
                // Note the missing 'plain' field:
                // it will be generate from the HTML content
            }
        },
        {
            "id": "newsletter-test-4",
            "name": "Newsletter Test List #4",
            "sender": "newsletter@example.com",
            "members": [ "test@example.com" ],
            // You can pass your message directly as a string.
            // The message.subject and message.plain will be generate
            "message": `
                <html>
                    <head>
                        <title>Hello, World!</title>
                    </head>
                    <body>
                        <p>The newsletter body in HTML</p>
                    </body>
                </html>`
        }
    ]
}
```

Then:

```js
const newsletter = require('newsletter-ses')

newsletter.configure(config.ses)
    .send(config.lists)
        .on('quota.error', (e) => {
            console.log(`Failed to get send quota`, e)
        })
        .on('start', (e) => {
            /*
                console.log(e) ==> 
                { 
                    report: {
                        listId: 'newsletter-test-1',
                        sender: 'newsletter@example.com',
                        start: '2016-12-31T17:25:05.380Z',
                        sent: [],
                        error: []
                    },
                    list: { ... },   // the current list
                }
            */
            
            console.log(`Starting to send emails to ${e.list.members.length} members`)
        })
        .on('batch', (e) => console.log(`batch ${e.iteration}/${e.cycle}`))
        .on('error', (e) => {
            /*
                console.log(e) ==> 
                { 
                    time: 2102.321,             // time of the sending operation in ms
                    member: 'user@example.com', // the current user
                    report: "...",              // the error stack
                    error: { ... },             // the error object
                    list: { ... }               // the current list
                }
            */
            
            console.log(`Error when sending an email to ${e.member.email} (${e.time} ms)`)
        })
        .on('sent', (e) => {
            /*
                console.log(e) ==> 
                { 
                    time: 2102.321,             // time of the sending operation in ms
                    member: 'user@example.com', // the current user
                    report: "...",              // the sucess request result
                    list: { ... }               // the current list
                }
            */
            
            console.log(`Sent to ${e.member.email} (${e.time} ms)`)
        })
        .on('complete', (e) => {
            /*
                console.log(e) ==> 
                { 
                    time: 16441.023,            // time of the operation in ms
                    report: {
                        listId: 'newsletter-test-1',
                        sender: 'newsletter@example.com',
                        start: '2016-12-31T17:25:05.380Z',
                        end: '2016-12-31T17:25:21.380Z',
                        sent: [ ... ],          // the list of success members
                        error: [ ... ],         // the list of failure members
                        duration: 16441.023
                    },
                    list: { ... }               // the current list
                }
            */
            
            console.log(`Finish to send ${e.list.id} (${e.time} ms)`)
        })
        .on('finish', () => console.log(`Finished to send ${config.lists.length} lists`))
```

## License

Under the MIT license. See [LICENSE](https://github.com/demsking/newsletter-ses/blob/master/LICENSE) file for more details.
