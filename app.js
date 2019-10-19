const express = require('express');
const app = express();
const fs = require('fs');
const fileUpload = require('express-fileupload');

app.use(express.static(__dirname));
app.set('view engine', 'ejs');
app.use(fileUpload());

const port = 3000;
const AWS = require('aws-sdk');

s3 = new AWS.S3({apiVersion: '2006-03-01'});
/*const config = new AWS.Config({
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    region: process.env.AWS_REGION
});*/
const client = new AWS.Rekognition();

app.post('/match_face', (req, res) => {
    if (req.files && req.files.face_file) {
        call_face_match(req.files.face_file.data).then(match => {
           if (match) {
               res.status(200).send('Match Found');
           }
           else {
               res.status(401).send('Not identified')
           }
        });
    }
    else {
        res.status(400).send('Must Specify File')
    }
});

app.listen(port, () => console.log(`Example app listening on port ${port}!`));
module.exports = app;

function obtainBucketItems() {
    return new Promise(resolve => {
        s3.listObjects({
            Bucket : "authorizedusers"
        }, function (err, data) {
            if (err) {
                resolve(null);
            } else {
                resolve(data);
            }
        });
    });
}

function matchFace(params) {
    return new Promise(resolve => {
        client.compareFaces(params, function (err, response) {
            if (err) {
                console.log(err, err.stack); // an error occurred
                resolve(false)
            } else {
                if (response.FaceMatches && response.FaceMatches.length > 0) {
                    resolve(true)
                } else {
                    resolve(false)
                }
            }
        });
    });
}

async function call_face_match(sourceImage) {
    var bucketItems = await obtainBucketItems();
    for (var i = 0; i < bucketItems.Contents.length; i++) {
        const params = {
            SourceImage: {
                Bytes: sourceImage
            },
            TargetImage: {
                S3Object: {
                    Bucket: 'authorizedusers',
                    Name: bucketItems.Contents[i].Key
                }
            },
            SimilarityThreshold: 70
        };

        var faceMatch = await matchFace(params);
        if (faceMatch) {
            return true;
        }
    }
    return false;
}
