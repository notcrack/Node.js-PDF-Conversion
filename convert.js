// Include the necessary packages
const express = require('express'); // For setting up our server
const libre = require('libreoffice-convert'); // For converting documents to PDF
const fs = require('fs'); // For file system operations
const path = require('path'); // For working with file and directory paths
const winston = require('winston'); // For logging
require('winston-daily-rotate-file'); // For rotating our log files daily

// Create an instance of an Express server
const app = express();
const port = 3000;

// Middleware to parse JSON requests, with a maximum limit of 50mb
app.use(express.json({limit: '50mb'}));

// Set up our logger with Winston
const logger = winston.createLogger({
  level: 'silly', // Log everything, including silly-level logs
  transports: [
    // Log to a new file every day
    new winston.transports.DailyRotateFile({
      level: 'silly',
      filename: 'logs/application-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      zippedArchive: true,
      maxSize: '20m',
      maxFiles: '60d',
      format: winston.format.combine(
        winston.format.timestamp({
          format: 'YYYY-MM-DD HH:mm:ss.SSS'
        }),
        winston.format.json()
      )
    }),
    // Also log to the console
    new winston.transports.Console({
      level: 'silly',
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.timestamp({
          format: 'YYYY-MM-DD HH:mm:ss.SSS'
        }),
        winston.format.printf((info) => `[${info.timestamp}] ${info.level}: ${info.message}`)
      )
    })
  ]
});

// Set up a route on our server that accepts POST requests to '/convert'
app.post('/convert', async (req, res) => {
  // Log that we received a conversion request
  logger.silly('Received a request to convert a file');

  // Extract the necessary data from the request body
  const data = Buffer.from(req.body.data, 'base64'); // The file data, encoded in base64
  const fileType = req.body.fileType; // The type of the file
  const messageID = req.body.messageID; // The ID of the message

  // If any necessary data is missing, return a 400 Bad Request error
  if (!data || !fileType || !messageID) {
    logger.error('Bad Request: data, fileType, or messageID is undefined.', { mirthMessageID: messageID });
    return res.status(400).send('Bad Request: data, fileType, or messageID is undefined.');
  }

  // Write the file to our system
  fs.writeFileSync(`temp.${fileType}`, data);

  const extend = '.pdf';

  // Function to handle the conversion result
  const done = (err, pdfBuffer) => {
    // If there was an error, log it and return a 500 error
    if (err) {
      logger.error(`An error occurred during conversion to PDF: ${err}`, { mirthMessageID: messageID });
      res.sendStatus(500);
    } else {
      // If successful, log that we successfully converted the file
      logger.info(`Successfully converted ${fileType} to PDF.`, { mirthMessageID: messageID });
    }

    // Delete the temporary file
    fs.unlinkSync(`temp.${fileType}`);
    // Send the converted PDF back in the response, encoded in base64
    res.send(pdfBuffer.toString('base64'));
  };

  // Convert the file to PDF
  libre.convert(data, extend, undefined, done);
});

// Start our server, listening on the specified port
app.listen(port, () => {
  logger.info(`Document-to-PDF service listening at http://localhost:${port}`);
});
