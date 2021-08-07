---
title: 记开发 fdutools 的经历
date: 2021-06-30
categories:
 - 码言
tags:
 - 旦
 - 学习
---

期末考后闲来无事，试着做一些自动化查询学生信息的工具，于是开始研究学校网站的登录机制。

<!-- more -->

## 登录教务处网站

#### 登录的过程

复旦所有网络服务的身份验证都是通过[UIS统一验证站点](https://uis.fudan.edu.cn/authserver/login)进行登录的，在请求参数中加上 `service=你要访问的站点`以指定目标站点。整个验证的过程是比较简单的，`POST ` 的请求体中包括**明文**的用户名及密码和防CSRF攻击的令牌。

因此登录的流程就很简单了：先 `GET` UIS站点以获得 token，再 `POST` 来进行登录。之前在 `GET` 时没有带上 `service`  字段，最终跳转到了 UIS 平台的个人页面，反复排查了很久都不知道原因，因为 `post` 请求带上了，也设置了 `referer` ，理论上应该是可以的，可能是因为后端作了一些控制吧。以为这样并没有登录成功，但实际上已经登录进去了，使用它发给你的cookie可以访问到所有其它站点（似乎选课系统的认证是独立开来的）。

#### 一些想法

学校的用户认证系统使用明文传递用户名和密码，这在**强制全站HTTPS**的情况下并无不可，但是它并没有这样做：如果直接访问域名的话会使用http协议连接，没有**任何**重定向至 https 的行为，更不说 HSTS 等其它基本的安全措施了。

教务系统的安全是很严重的问题，在特定情况下可能会影响到保研、选择专业、选课等事务，当然复旦信息办相较之下还算是好的了，笔者高中的教务系统还曾被学生轻松提权，修改成绩等敏感数据。

## 初探装饰器

之后的一些查询和数据的处理是比较简单的了，但在请求数据时会出现重复登录的情况

![当前用户存在重复登录的情况，已将之前的登录踢出](https://pic.salve.cf/images/2021/06/30/20210630194312.png)

自然的想法是进行一个判断，如果出现了重复登录就点击它提供的链接。为了简化重复的代码，试着使用装饰器，但出现了一个传参的问题，折腾了好久。

为了使用装饰器，重写了 `httpx` 的 `get` 方法，具体的逻辑就是如果请求来的页面含有“重复登录”的提示，就将请求的 `url` 替换为网页提供的 `url` 再返回，否则就原封不动地将请求返回。

```python
def repeated_login(func):
    @wraps(func)
    def wrapper(*args, **kwargs):
        r = func(*args, **kwargs)
        if '当前用户存在重复登录的情况' in r.text:
            soup = BeautifulSoup(r.text, features='lxml')
            new_url = soup.a['href']
            # arg[1]是url
            args = list(args)
            args[1] = new_url
            return func(*args, **kwargs)
        else:
            return r
    return wrapper

class Client(httpx.Client):
    @repeated_login
    def get(self, *args, **kwargs):
        return super().get(*args, **kwargs)
```

问题的关键在于，由于 `get` 是对象的方法，当其传给装饰器时，默认的第一个参数是 `self` ，业务逻辑中的第一个参数 `url` 就会变成 `arg` 中的第二个。因此需要将修改后的 `url` 替换至 `arg[1]` 。

看似简单的一个问题，其实考验了不少对于基础概念的理解，也耗费了蛮多时间，特此记录。

