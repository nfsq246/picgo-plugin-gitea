# picgo-plugin-gitea

PicGo Uploader For Gitea

### Usage

#### input your config
- owner: gitea project's owner name
- repo: gitea project repo
- token: gitea's api token
- path: img path in response json (eg:url or data.url)
- message: gitea commit 

#### init your remote repo
- create git repo?
```bash
mkdir resources
cd resources
git init
touch README.md
git add README.md
git commit -m "first commit"
git remote add origin your-remote-link
git push -u origin master
```
- exists repo?
```
cd existing_git_repo
git remote add origin your-remote-link
git push -u origin master
```

### Feature
- support sync gitee file delete

### Todo

- [x] trim / delimiter

