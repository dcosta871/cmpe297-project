const express = require('express');
const app = express();
const fs = require('fs');
const path = require('path');
const fileUpload = require('express-fileupload');

var text_params = {
    Message: '',
    PhoneNumber: '14086247305',
};

app.use(express.static(__dirname));
app.set('view engine', 'ejs');
app.use(fileUpload());

const port = 3000;
const AWS = require('aws-sdk');

s3 = new AWS.S3({apiVersion: '2006-03-01'});
const client = new AWS.Rekognition();
app.get('/', (req,res) => {
   res.status(200).send('Face Server');
});
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
        res.status(400).send('Must Specify face_file')
    }
});

app.post('/face', (req, res) => {
    if (req.files && req.files.face_file) {
        uploadFace(req.files.face_file).then(uploaded => {
            if (uploaded) {
                res.status(200).send('Face Uploaded');
            }
            else {
                res.status(500).send('Error uploading face')
            }
        });
    }
    else {
        res.status(400).send('Must Specify face_file')
    }
});

app.delete('/face/:faceKey', (req, res) => {
    deleteFace(req.params.faceKey).then(deleted => {
        if (deleted) {
            res.status(200).send('Face Deleted');
        }
        else {
            res.status(500).send('Error deleting face')
        }
    });
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

function uploadFace(file) {
    return new Promise(resolve => {
        var uploadParams = {Bucket: "authorizedusers", Key: '', Body: ''};
        uploadParams.Body = file.data;
        uploadParams.Key = file.name;
        s3.upload (uploadParams, function (err, data) {
            if (err) {
                resolve(false);
            } if (data) {
                resolve(true);
            }
        });
    });
}

function deleteFace(key) {
    return new Promise(resolve => {
        var params = {  Bucket: 'authorizedusers', Key: key };
        s3.deleteObject(params, function(err, data) {
            if (err){
                resolve(false)
            }
            else {
                resolve(true)
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
                    var keyName = params.TargetImage.S3Object.Name;
                    var faceMatch = keyName.substring(0, keyName.length - 4);
                    sendText(faceMatch + " detected");
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
    sendText("Unrecognized person detected");
    return false;
}

function sendText(message) {
    text_params.Message = message;
    var publishTextPromise = new AWS.SNS({apiVersion: '2010-03-31'}).publish(text_params).promise();
    publishTextPromise.then(
        function(data) {
            console.log("MessageID is " + data.MessageId);
        }).catch(
        function(err) {
            console.error(err, err.stack);
        });
}
