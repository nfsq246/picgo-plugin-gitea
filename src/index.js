const uploadedName = "gitea";
const defauleBranch = "master"
const defaultMsg = "picgo commit";

module.exports = (ctx) => {
  const register = () => {
    ctx.helper.uploader.register(uploadedName, {
      handle,
      name: "Gitea图床",
      config: config,
    });

    ctx.on("remove", onRemove);
  };

  const getHeaders = function () {
    return {
      "Content-Type": "application/json;charset=UTF-8",
      "User-Agent": "PicGo",
    };
  };

  const getUserConfig = function () {
    let userConfig = ctx.getConfig("picBed.gitea");

    if (!userConfig) {
      throw new Error("Can't find uploader config");
    }

    userConfig["baseUrl"] =
      userConfig.url + "/api/v1/repos/" + userConfig.owner + "/" + userConfig.repo;
    userConfig["previewUrl"] =
      userConfig.url +
      "/" +
      userConfig.owner +
      "/" +
      userConfig.repo +
      "/raw/branch/" +
      formatConfigBranch(userConfig) +
      formatConfigPath(userConfig);

    userConfig["message"] = userConfig.message || defaultMsg;

    return userConfig;
  };

  // uploader
  const handle = async function (ctx) {
    let userConfig = getUserConfig();

    const realUrl =
      userConfig.baseUrl + "/contents" + formatConfigPath(userConfig);

    let imgList = ctx.output;
    for (let i in imgList) {
      let image = imgList[i].buffer;
      if (!image && imgList[i].base64Image) {
        image = Buffer.from(imgList[i].base64Image, "base64");
      }

      let perRealUrl = realUrl + "/" + imgList[i].fileName;
      const postConfig = postOptions(perRealUrl, image);

      try {
        await ctx.Request.request(postConfig);
        imgList[i]["imgUrl"] =
          userConfig.previewUrl + "/" + imgList[i].fileName;
      } catch (err) {
        ctx.log.info("[上传操作]异常：" + err.message);
        // duplicate file, so continue
        if (checkIsDuplicateFile(err.message)) {
          ctx.emit("notification", {
            title: "上传失败",
            body: "文件已经存在了",
          });
          continue;
        } else {
          ctx.emit("notification", {
            title: "上传失败",
            body: JSON.stringify(err),
          });
        }
      }

      delete imgList[i].base64Image;
      delete imgList[i].buffer;
    }

    return ctx;
  };

  const checkIsDuplicateFile = (message) => {
    return message.indexOf("A file with this name already exists") != -1;
  };

  const postOptions = (url, image) => {
    let config = getUserConfig();
    let headers = getHeaders();
    let formData = {
      access_token: config.token,
      content: image.toString("base64"),
      message: config.message || defaultMsg,
    };
    const opts = {
      rejectUnauthorized: false,
      method: "POST",
      url: encodeURI(url),
      headers: headers,
      formData: formData,
    };
    return opts;
  };

  // trigger delete file
  const onRemove = async function (files) {
    // log request params
    const rms = files.filter((each) => each.type === uploadedName);
    if (rms.length === 0) {
      return;
    }

    ctx.log.info("删除个数:" + rms.length);
    ctx.log.info("uploaded 信息:");
    let headers = getHeaders();
    let config = getUserConfig();
    const fail = [];

    for (let i = 0; i < rms.length; i++) {
      const each = rms[i];
      let urlpath = getFilePath(each.imgUrl);
      let filepath = urlpath[0];
      let sha = await getSha(filepath).catch((err) => {
        ctx.log.info("[删除操作]获取sha值：" + JSON.stringify(err));
      });

      let url =
        `${filepath}` +
        `?access_token=${config.token}` +
        `&message=${config.message}` +
        `&branch=${urlpath[1]}` +
        `&sha=${sha}` +
        `&signoff=true`;
      ctx.log.info("[删除操作]当前删除地址：" + url);
      let headerplus = headers + "Authorization: token ${config.token}";
      let opts = {
        rejectUnauthorized: false,
        method: "DELETE",
        url: encodeURI(url),
        headers: headerplus,
      };
      ctx.log.info("[删除操作]当前参数" + JSON.stringify(opts));
      try {
        await ctx.request(opts);
      } catch (e) {
        ctx.log.info(e);
        fail.push(each.fileName);
      }
    }

    ctx.emit("notification", {
      title: "删除提示",
      body: fail.length === 0 ? "成功同步删除" : `删除失败${fail.length}个`,
    });
  };


  const getFilePath = function (url) {
    let host = url.substring(0, url.indexOf("/raw/branch"));
    host = host.substring(0, host.lastIndexOf("/"));
    host = host.substring(0, host.lastIndexOf("/"));
    let urlStr = url.replace(host, host + "/api/v1/repos");
    let branch = url.substring(url.indexOf("/raw/branch/") + 12);
    branch = branch.substring(0, branch.indexOf("/"));

    let urlpath = new Array();
    urlpath[0] = urlStr.replace("raw/branch/" + branch, "contents");
    urlpath[1] = branch;
    return urlpath;
  };


  const getSha = async function (filepath) {
    let config = getUserConfig();
    let headers = getHeaders();
    let url = `${filepath}` + `?access_token=${config.token}`;

    const opts = {
      rejectUnauthorized: false,
      method: "GET",
      url: encodeURI(url),
      headers: headers,
    };

    let res = await ctx.Request.request(opts);
    let tmp = JSON.parse(res);

    return tmp.sha;
  };

  const formatConfigPath = function (userConfig) {
    return userConfig.path ? "/" + userConfig.path : "";
  };
  const formatConfigBranch = function (userConfig) {
    return userConfig.branch ? "/" + userConfig.path : defauleBranch;
  };
  const config = (ctx) => {
    let userConfig = ctx.getConfig("picBed.gitea");
    if (!userConfig) {
      userConfig = {};
    }
    return [{
        name: 'url',
        type: 'input',
        default: userConfig.url,
        required: true,
        message: 'https://gitea.com',
        alias: 'url'
      },
      {
        name: "owner",
        type: "input",
        default: userConfig.owner,
        required: true,
        message: "owner",
        alias: "owner",
      },
      {
        name: "repo",
        type: "input",
        default: userConfig.repo,
        required: true,
        message: "repo",
        alias: "repo",
      },
      {
        name: "branch",
        type: "input",
        default: userConfig.branch,
        required: false,
        message: "branch;默认master",
        alias: "branch",
      },
      {
        name: "path",
        type: "input",
        default: userConfig.path,
        required: false,
        message: "path;根目录可不用填",
        alias: "path",
      },
      {
        name: "token",
        type: "input",
        default: userConfig.token,
        required: true,
        message: "5664b5620fb11111e3183a98011113ca31",
        alias: "token",
      },
      {
        name: "message",
        type: "input",
        default: userConfig.message,
        required: false,
        message: defaultMsg,
        alias: "message",
      },
    ];
  };
  return {
    uploader: "gitea",
    register,
  };
};