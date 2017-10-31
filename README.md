# newsletter-ses
Send newsletters using AWS SES

[![Build Status](https://travis-ci.org/demsking/newsletter-ses.svg?branch=master)](https://travis-ci.org/demsking/newsletter-ses)
[![Coverage Status](https://coveralls.io/repos/github/demsking/newsletter-ses/badge.svg?branch=master)](https://coveralls.io/github/demsking/newsletter-ses?branch=master)

1. [Install](#install)
2. [Config format](#config)
3. [CLI usage](#cli)
4. [Programmatic usage](#node)
5. [License](#license)

# <a name="install">Install</a>
```shell
# to install as a dependency
npm install --save newsletter-ses

# to install the binary
npm install -g newsletter-ses
```

# <a name="config">The config format</a>

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

## <a name="cli">CLI usage</a>

Firstly install `newsletter-ses` in the global environment:

`npm install -g newsletter-ses`

Then open the terminal and pass the JSON config to the `newsletter-ses`'s CLI:

```shell
# simple usage
newsletter-ses '{"ses": {...}, "lists": [ ... ]}'

# redirect output to a file
newsletter-ses '{"ses": {...}, "lists": [ ... ]}' > output.log
```

You can also use pipe `|`:

```shell
# use local config
cat path/to/config.json | newsletter-ses > output.log

# use remote config
curl https://example.com/config.json | newsletter-ses > output.log
```

So with this previous example, you can use `cron` to send daily newsletter:

```shell
# send newsletter at 08:00 AM, Monday through Friday
cron 0 8 * * 1-5 curl https://example.com/api/rest/daily | newsletter-ses > daily-`date +%Y%m%d_%H%M%S`.log
```

### Specific CLI feature

When using the CLI, you can use the config `list.sendReportTo` to automatically send report when the sending job is complete:

```js
const config = {
    ses: { ... },
    lists: [
        {
            ...
            sendReportTo: [
                'admin@example.com'
            ]
        }
    ]
}
```

## <a name="node">Programmatic usage</a>

```js
const newsletter = require('newsletter-ses')
const config = require('./config.json')

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
                        members: 1,             // The number of members in the list
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
                        members: 1,             // The number of members in the list
                        start: '2016-12-31T17:25:05.380Z',
                        end: '2016-12-31T17:25:21.380Z',
                        error: [ ... ],         // the list of failure members
                        sent: [ ... ],          // the list of success members
                        duration: 16441.023
                    },
                    list: { ... }               // the current list
                }
            */
            
            console.log(`Finish to send ${e.list.id} (${e.time} ms)`)
        })
        .on('finish', () => console.log(`Finished to send ${config.lists.length} lists`))
```

## <a name="license">License</a>

Under the MIT license. See [LICENSE](https://github.com/demsking/newsletter-ses/blob/master/LICENSE) file for more details.
