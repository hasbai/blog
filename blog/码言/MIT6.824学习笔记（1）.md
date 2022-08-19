---
title: MIT 6.824 学习笔记 (1)
date: 2022-08-19
categories:
 - 码言
tags:
 - MIT 6.824
 - 系统设计
---

MIT 6.824 分布式系统也算是一门网红课了。这个系列打算一个 Lab 写一篇笔记，希望不要半途而废~

<!-- more -->

## 简述

MapReduce 是 Google 于 2004 年提出的一个编程模型，被广泛地应用于分布式计算、大数据等领域。简单来说就是一个分治的思想，Map 就是把输入数据拆开来产生中间文件（Intermediate files），Reduce 就是把中间文件收集起来计算得出结果。

![MapReduce 框架图](https://pic.hath.top/images/2022/08/19/IOStS.png)

这样的设计使得 Map 和 Reduce 可以独立并行地运行在多台机器（worker）上，互不干扰 。使用者只需编写需要的 Map 和 Reduce 函数，把它丢给框架就可以实现并行计算了。

MapReduce 中，Map 和 Reduce 是完全解耦的，任务（Map / Reduce）与工作进程（Worker）也是解耦的。也就是说，有几个 Map、几个 Reduce，这些 Map 和 Reduce 运行在多少 Worker 上都是可以的，这样就给任务的调度提供了很大灵活性，整个系统也更加稳定。唯一的限制是，Reduce 任务必须等到 Map 任务全部完成后才能运行，整体上是有顺序的。

为什么每个 Map 要生成 n 个中间文件？为了把任务均匀地摊给 Reduce，给每个 Reduce 均等的数据（可以给 key 算个哈希），这样也能让一个 Reduce 处理同一类的数据（比如所有以 a 开头的单词），最后汇总的时候只需要 “拼接“ 而无需 ”合并“ 了。

## Lab 实现

6.824 的 Lab 1 就要求我们实现一个 MapReduce 的系统。总体来说不算难，但是有点肝，因为是分布式系统所以 debug 起来比较麻烦，很多时候只能通过打日志来找出问题。

课程提供的代码是在类 Unix 系统下运行的，用到了 Golang 的动态链接库和 shell 脚本，这在 Windows 系统下是无法运行的，因此笔者对官方代码进行了一通魔改，使其可以在 Windows 上运行与测试。Github 仓库在 https://github.com/hasbai/MIT6.824，尽管官方不建议公开 Lab 的代码，但考虑到笔者的版本可以方便 Windows 用户，还是公开了这些代码。

### 设计思路

简单说一下笔者的设计思路，在这个Lab 中我们只需要实现任务调度与输入输出，具体的 Map 和 Reduce 函数是已经写好的，用于测试不同的功能。

任务调度由 coordinator 和 worker 组成，出于简单考虑采用了 C/S 的结构，worker 轮询任务并执行，coordinator 只需响应请求给出任务即可，这样无法主动获取 worker 和 task 的状态，但也避免了把任务发给死掉的 worker 的情况。

#### mrapp

官方版本中对每个 mrapp（即一组 Map & Reduce 函数）分别编译为动态库加载后调用，这样的设计比较丑陋，因此笔者在 `interface.go` 内定义了一个 MapReduce 的接口，含有 Map 和 Reduce 函数，并写了一个工厂方法加载不同的 mrapp。

```go
type MapReduce interface {
   Map(file string, contents string) []models.KeyValue
   Reduce(key string, values []string) string
}
```

#### coordinator

有这么几个问题：

如何得知 task 的状态？coordinator 无法主动获取 worker 和 task 的状态，因此需要设置一个超时。超时任务一律认为失败，回到任务队列；worker 请求任务时，发送上一个任务成功或失败的状态。

如何存储任务？任务分为三类，待执行、执行中和已执行。已执行的任务直接丢掉就可以，待执行的任务容易想到使用队列存储，但由于 go 自带的队列不支持泛型，笔者用 go 的切片造了一个线程安全的“队列”。（其实是一个先进后出的栈，真正的队列要用双向链表，比较麻烦，而且 MapReduce 不在乎任务的先进先出，只需要保证 Reduce 在 Map 后就可以了。）至于执行中的任务，由于存在从 workerID 取 task 的需要，采用了一个线程安全的哈希表（sync.Map）存储。

如何确保 Reduce 在 Map 后执行？对已完成的 Map 任务计数（需要线程安全），尚未全部完成但去到 Reduce 的任务时挂起即可。（关于这个可以看后面遇到的一个 bug）

如何结束？没有任务了（队列和 map 中都没有）了就结束 coordinator 。

#### worker

worker 是比较简单的，只需要在一个循环里面不断获取并执行任务就可以了。

### 遇到的 bug

因为写的时候很小心，遇到的 bug 不是很多，主要的就以下几处：

#### 等待的方式：服务端挂起 or 客户端轮询？

等待 Map 任务完成有两种处理方式，一是服务端（coordinator）挂起请求，所有 Map 完成后释放；二是服务端直接返回一个 wait 的信号，客户端等待后轮询。

第一种方式正常情况下是没有问题的，因为 worker 会带着上一个请求已完成的信息来到 coordinator，前 n-1 个 worker 会因为 Map 没有全部完成被挂起，最后一个抵达的 worker 会完成 Map 并释放所有请求。但如果第 n 个 worker 意外崩溃了，而前 n-1 个 worker 已被挂起，就无法继续下去了。

作为 C/S 结构的设计，本来就应该以第二种模式为佳，但笔者为了尝试 go 的 sync.Cond 功能采取了第一种模式，才遇到了这个 bug。

#### 线程安全

标准库里有不少线程安全的轮子，比如 sync.Map, atomic.Add 之类，尽量避免手动上锁能减少很多可能发生的线程安全问题。唯一有一处取了任务队列的 Top() 以后再 Pop()，对于“取出来看一看”的场景，应该先 Pop() 再 Push() ，这样操作是原子性的。

## 总结

MapReduce 的好处是简单、稳定，但有以下缺点：

- 仅暴露出 Map 和 Reduce 两个接口，抽象程度较低，复杂的任务实现起来比较麻烦。
- 中间文件通过磁盘存储交换，IO 效率较低（多机器的话，还要使用网络文件系统，效率更低了）。
- 中间文件多，如果有 m 个 Map 任务和 n 个 Reduce 任务，就会产生 m*n 个中间文件。

MapReduce 是一个将近 20 年前提出的概念，如今它作为一个编程框架已逐渐被其它技术取代，但就其作为一种直观的分布式系统设计的思想来说仍然值得学习。
