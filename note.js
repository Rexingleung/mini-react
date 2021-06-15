// fiber: 就是一个数据结构他有很多属性
// 虚拟dom是对真实dom的一种简化
// 一些真实dom都做不到的事情那虚拟dom更做不到
// 就有了fiber有很多的属性希望借由fiber.上的这堆属性
// 来做到一些比较厉害的事情
// fiber架构
// 为了弥补一些不足就设计了一些新的算法
// 而为了能让这些算法跑起来所以出现了fiber这种数据结构
// fiber这种数据结构 + 新的算法 = fiber架构

// react应用从始至终管理着最基本的三样东西
// 1. Root(整个应用的根儿一个对象不是fiber 有个属性指向current树)
// 2. current树(树上的每一个节点都是fiber 保存的是上一次的状态并且每个fiber节点 都对应着一个jsx节点)
// 3. workInProgress树(树 上的每一个节 点都是fiber保存的是本次新的状态并且每个fiber节点都对应一个jsx节点) uninitialFiber

// 初次渲染的时候没有current树
// react在开始将创建Root就会同时创建 一个uninitialFiber 的东西( 未初始化的fiber )
// 让react的current指向了uninitialFiber
// 之后再去创建个 本次要用到的wqrkInProgress

// react中主要分两个阶段
// render阶段(指的是创建fiber的过程)
// 1.为每个节点创建新的fiber( workInProgress)(可能是复用)生成-颗有新状态的workInProgress树
// 2.初次渲染的时候(或新创建了某个节点的时候)会将这个fiber创建真实的dom实例并且对当前节点的子节点进行插入(使用原生的append的api进行插入)
// 3.如果不是初次渲染的话就对比新旧的fiber的状态将产生了更新的fiber节点最终通过链表的形式挂载到RootFiber

// 不管是初次渲染还是setState, 每次更新都是从Root往下更新的

// Commit阶段
// 才是真正要 操作页面的阶段
// 1.执行生命周期
// 2.会从RootFiber上获取到那条链表根据链表上的标识来操作页面

// setState更新是同步的还是异步
// 如果是正常情况下也就是没有使用Concurrent组件的情况下是同步更新的
// 但是不会立即获取到最新的state的值因为调用setState只是单纯地将你传进来的
// 新的state放入updateQueue这条链表上等这个点击事件结束之后会触发内部的一个回调函数
// 在这个回调函数中才会真正地去更新state以及重新渲染
// 当使用了Concurrent组件的时候这种情况下才是真正的异步更新模式
// 同样的没法立即获取最新状态并且在执行react的更新和渲染的过程中
// 使用了真正的异步方式( postMessage)这个才时真正的异步