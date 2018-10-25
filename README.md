# FileUtils

*Download
```
    let downloader = new FileUtils.Downloader({
        url : "http://www.example.com/example.apk",
        filename: "example-download.apk",
        onSuccess: function (fileEntry) {
            console.log(fileEntry);
        },
        onFail: function (errorCode) {
            console.log(errorCode);
        },
        onCancel: function () {
            alert("canceled");
        },
        onProgress: function (progressEvent) {
            let percent = (progressEvent.loaded / progressEvent.total * 100).toFixed(2);
            console.log(percent + "%")
        }
    });
```
*Upload
```
  let uploader = new FileUtils.Uploader({
        url: "http://www.example.com/upload",
        fileUri: "file:///storage/emulated/0/example.apk",
        fileAlias: "APK_FILE", //the fieldname of file, by default "file"
        params: {
            //post params
        }
    });
    uploader.upload();
```
*getMIMEType
```
  let mimetype = FileUtils.getMIMEType("apk");
```
