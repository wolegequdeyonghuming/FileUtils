/***
 * FileUtils for cordova Android use only,
 * and this is born for replacing file-transfer plugin.
 * If you want to specify the storage location, you need to install cordova-plugin-file
 * and use it, then see how it works.
 *
 * @author M4
 * @licence MIT
 * @version 1.0
 * @copyright M4
 * 2018-10-10
 */



/***
 * @type {Object}
 */
var FileUtils = new Object();

/***
 * Downloader Object
 * @constructor
 * @param {object} option: set option for downloader
 * @property {string} url: download url
 * @property {string} filename: filename with type, e.g. "who killed me.doc"
 * @property {string} saveLocation: android save location
 * @property {boolean} withCredential: set xhr.withCredential
 * @property {function} onProgress
 * @property {function} onSuccess
 * @property {function} onFail
 * @property {function} onCancel
 */
FileUtils.Downloader = function(option = {}){
    this.url = option.url;
    this.filename = option.filename;
    this.saveLocation = option.saveLocation;
    this.withCredential = option.withCredential || true;
    this.onProgress = option.onProgress || function (progressEvent) { };
    this.onSuccess = option.onSuccess || function (fileEntry) { };
    this.onFail = option.onFail || function (errorCode) { };
    this.onCancel = option.onCancel || function () { };
    //TODO params is not used in current version, please add params into url
    this.params = option.params || {};

    //error code
    this.error = {};
    this.error.CANCELED = 0;
    this.error.SUCCESS = 1;
    this.error.NO_URL = -1;
    this.error.NO_FILENAME = -2;
    this.error.FILE_SYSTEM_ERROR = -3;
    this.error.LOCAL_FILE_SYSTEM_ERROR = -4;
    this.error.XHR_STATUS_ERROR = -5;
    this.error.SAVE_FILE_ERROR = -6;
    this.error.WRITE_FILE_ERROR = -7;
};

FileUtils.Downloader.prototype = {
    url: "",
    filename: "",
    saveLocation: "",
    withCredential: true,
    onProgress: function (progressEvent) {},
    onSuccess: function (fileEntry) {},
    onFail: function (errorCode) {},
    onCancel: function () {},
    xhr: null,
    params: {},
    error: {},
    fileType: "",
    mimeType: ""
}

/**
 * destroy
 * @method
 */
FileUtils.Downloader.prototype.destroy = function(){
    delete this;
    return true;
};

/**
 * cancel
 * @method
 */
FileUtils.Downloader.prototype.cancel = function(){
    if(this.xhr){
        this.xhr.abort();
    }
    this.onCancel();
    this.destroy();
};

/**
 * beforeDownload
 * @method
 * data verifying before download start
 * @return {boolean}
 */
FileUtils.Downloader.prototype.beforeDownload = function(){
    /*
      Some option must be specified!
     */
    if(!this.url){
        console.warn("url is undefined!\n e.g.\n var downloader = new FileUtils.Downloader({url: '...'});\n or\n downloader.url = '...' ");
        this.onFail(-1);
        return false;
    }
    if(!this.filename){
        console.warn("filename is undefined!\n e.g.\n var downloader = new FileUtils.Downloader({filename: '...'});\n or\n downloader.filename = '...' ");
        this.onFail(-2);
        return false;
    }

    /*
      Trying to find location to save file when saveLocation is not specified:
      if cordova-plugin-file installed, save into externalApplicationStorageDirectory,
      if not, try to save into /root.
     */
    if(!this.saveLocation){
        try{
            this.saveLocation = cordova.file.externalApplicationStorageDirectory;
        }catch (e) {
            console.log("cordova-plugin-file plugin is not installed, try to save into /root");
            this.saveLocation = "";
            this.useFileSystemLocation = true;
        }
    }

    /*
      Trying split file type and get MIME-type
     */
    this.fileType = this.filename.substring(this.filename.lastIndexOf(".") + 1);
    this.mimeType = FileUtils.getMIMEType(this.fileType);

    if(!this.fileType){
        console.log("fileType is not defined, please check your filename:" + this.filename);
    }
    else if(this.mimeType === ""){
        console.log("MIME-type is not defined, please check your fileType:" + this.fileType);
    }

    this.filename = decodeURI(this.filename);
    this.url = decodeURI(this.url);
    return true;
};

/**
 * download
 * @method
 * start download
 * */
FileUtils.Downloader.prototype.download = function(){

    const _this = this;

    // verify failed
    if(!this.beforeDownload()){
        this.destroy();
        return
    }

    // start
    if (this.useFileSystemLocation){
        try{
            window.requestFileSystem(window.PERSISTENT, 0, function (fileSystem) {
                _this.getFile(fileSystem.root);
            }, function (error) {
                console.error('Error requestFileSystem:' + error.toString());
                _this.onFail(-3);
            });
        }catch (error) {
            _this.getFile();
            console.error('Error:' + error.toString());
            _this.onFail(-3);
        }
    }
    else{
        window.resolveLocalFileSystemURL(this.saveLocation, function (saveEntry) {
                _this.getFile(saveEntry);
            }, function (error) {
                console.error('Error resolveLocalFileSystemURL:' + error.toString());
                _this.onFail(-4);
            });
    }
};

/**
 * getFile
 * @param {Entry} saveEntry
 */
FileUtils.Downloader.prototype.getFile = function(saveEntry){

    const _this = this;

    let xhr = new XMLHttpRequest();
    xhr.withCredentials = _this.withCredential;
    xhr.open('GET', _this.url, true);
    xhr.responseType = 'blob';

    //return xhr instance
    _this.xhr = xhr;

    //onProgress
    xhr.onprogress = function(progressEvent) {
        _this.onProgress(progressEvent);
    };

    //onLoaded
    xhr.onload = function() {
        if (this.status === 200) {
            let blob = new Blob([this.response], { type: _this.mimeType });
            _this.saveFile(saveEntry, blob);
        }
        else {
            console.error("download failed, xhr status code:" + this.status);
            _this.onFail(-5);
        }
    };

    xhr.onabort = function() {
        _this.onCancel();
    };

    xhr.send();
};

/**
 * saveFile
 * @param saveEntry
 * @param {blob} fileData
 * create File object in file system
 * */
FileUtils.Downloader.prototype.saveFile = function(saveEntry, fileData) {

    const _this = this;

    saveEntry.getFile(_this.filename, { create: true, exclusive: false }, function (fileEntry) {
        _this.writeFile(fileEntry, fileData);
    }, function (err) {
        console.error('Error when saveFile:' + err.toString());
        _this.onFail(-6);
    });
}

/**
 * writeFile
 * @param fileEntry
 * @param fileData
 **/
FileUtils.Downloader.prototype.writeFile = function(fileEntry, fileData) {

    const _this = this;

    // Create a FileWriter object for our FileEntry (log.txt).
    fileEntry.createWriter(function (fileWriter) {

        fileWriter.onwriteend = function() {
            console.log("download success!");
            _this.onSuccess(fileEntry);
        };

        fileWriter.onerror = function(e) {
            console.error("Failed file write: " + e.toString());
            _this.onFail(-7);
        };

        fileWriter.write(fileData);
    });
};



/***
 * Uploader Object
 * @constructor
 * @param option
 * @property url: your request url
 * @property fileUri: the uri of file, e.g. 'file:///storage/emulated/0/well done.txt'
 * @property fileAlias: the field name of file, default 'file'
 * @property params: post data, work as ajax's data
 * @property onProgress
 * @property onSuccess
 * @property onFail
 * @property onCancel
 */
FileUtils.Uploader = function (option = {}) {
    this.url = option.url;
    this.fileUri = option.fileUri;
    this.fileAlias = option.fileAlias || "file";
    this.params = option.params;
    this.onProgress = option.onProgress || function (progressEvent) { };
    this.onSuccess = option.onSuccess || function (result) { };
    this.onFail = option.onFail || function (errorCode) { };
    this.onCancel = option.onCancel || function () { };
};

FileUtils.Uploader.prototype = {
    url: "",
    fileUri: "",
    fileAlias: "",
    params: {},
    onProgress: null,
    onSuccess: null,
    onFail: null,
    onCancel: null,
    xhr: null
};

/**
 * destroy
 * @method
 */
FileUtils.Uploader.prototype.destroy = function(){
    delete this;
    return true;
};

/**
 * beforeUpload
 * @return {boolean}
 */
FileUtils.Uploader.prototype.beforeUpload = function(){
    /*
      Some option must be specified!
     */
    if(!this.url){
        console.warn("url is undefined!\n e.g.\n var uploader = new FileUtils.Uploader({url: '...'});\n or\n uploader.url = '...' ");
        this.onFail(-1);
        return false;
    }
    if(!this.fileUri){
        console.warn("filename is undefined!\n e.g.\n var uploader = new FileUtils.Uploader({fileUri: '...'});\n or\n uploader.fileUri = '...' ");
        console.warn("make sure using cordova-plugin-file to get your file uri");
        this.onFail(-2);
        return false;
    }

    return true;
};

/**
 * upload
 * @method
 */
FileUtils.Uploader.prototype.upload = function () {

    const _this = this;

    if(!_this.beforeUpload()){
        _this.destroy();
        return
    }

    /*
        Try to transfer file uri into file entry object
        this might fail because of not using cordova-plugin-file, or launched in browser
     */
    try{
        window.resolveLocalFileSystemURL(_this.fileUri, function (fileEntry) {
            _this.getFile(fileEntry)
        })
    }catch (e) {
        console.error("file system error");
        console.error(e);
    }
};

/**
 * getFile
 * @param fileEntry
 */
FileUtils.Uploader.prototype.getFile = function (fileEntry) {

    const _this = this;

    /*
        You also need a FileEntry object to read an existing file.
        Use the file property of FileEntry to get the file reference,
        and then create a new FileReader object.
        You can use methods like readAsText to start the read operation.
        When the read operation is complete,
        this.result stores the result of the read operation.
     */
    try{
        fileEntry.file(function (file) {

            //file info
            const fileName = file.name;
            const fileLength = file.size;
            const fileType = fileName.substring(fileName.lastIndexOf(".") + 1);
            const mimeType = FileUtils.getMIMEType(fileType);

            //read file
            var reader = new FileReader();

            reader.onloadend = function() {
                var blob = new Blob([new Uint8Array(this.result)], { type: mimeType });
                _this.post(blob, fileName);
            };

            reader.readAsText(file);
        })
    }catch (e) {
        console.warn(e);
    }
};

/**
 * post
 * @param {Blob} blob
 * @param fileName
 */
FileUtils.Uploader.prototype.post = function (blob, fileName) {

    const _this = this;

    /*
        generate formData
        In this case, any value in _this.params should be string/number etc.
        So, if there is any JSON value, just use JSON.stringify()
        e.g.
        var params = {
            searchField: JSON.stringify( {name: 'Octopath Traveller', type: 'game'} ),
            id: 8
        }
     */
    let formData = new FormData();
    for(let i in _this.params){
        formData.append(i, _this.params[i]);
    }
    formData.append(_this.fileAlias, blob, fileName);

    /*
        use xhr post FormData
        and return xhr instance.
     */
    let xhr = new XMLHttpRequest();

    _this.xhr = xhr;

    xhr.open("POST", _this.url, true);

    xhr.onload = function(result){
        console.log("upload finished:" + fileName);
        _this.onSuccess(result);
    };

    xhr.onprogress = function(progressEvent){
        _this.onProgress(progressEvent);
    };

    xhr.onerror = function(e){
        console.error(e);
        _this.onFail(-8, e);
    };

    xhr.send(formData);
};


/**
 * getMIMEType
 * @param fileType
 */
FileUtils.getMIMEType = function (fileType) {
    const json = {
        apk: "application/vnd.android.package-archive",
        avi: "video/x-msvideo",
        bin: "application/octet-stream",
        bmp: "image/bmp",
        class: "application/octet-stream",
        css: "text/css",
        dir: "application/x-director",
        dll: "application/x-msdownload",
        doc: "application/msword",
        docx: "application/msword",
        exe: "application/octet-stream",
        gif: "image/gif",
        gtar: "application/x-gtar",
        gz: "application/x-gzip",
        htm: "text/html",
        html: "text/html",
        ico: "image/x-icon",
        jpe: "image/jpeg",
        jpeg: "image/jpeg",
        jpg: "image/jpeg",
        js: "application/x-javascript",
        m3u: "audio/x-mpegurl",
        mov: "video/quicktime",
        mp3: "audio/mpeg",
        mpeg: "video/mpeg",
        pdf: "application/pdf",
        png: "image/png",
        ppt:"application/vnd.ms-powerpoint",
        rar:"application/x-rar-compressed",
        svg:"image/svg+xml",
        swf:"application/x-shockwave-flash",
        tar:"application/x-tar",
        tgz:"application/x-compressed",
        tif:"image/tiff",
        tiff:"image/tiff",
        txt:"text/plain",
        wav:"audio/x-wav",
        wps:"application/vnd.ms-works",
        xls:"application/vnd.ms-excel",
        xlsx:"application/vnd.ms-excel",
        zip:"application/zip"
    };
    return json[fileType] || "";
};
