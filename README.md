近600行的代码模拟了react初次渲染的过程, 包括了react的fiber数据结构以及dom深度遍历和创建子元素的过程; 

### react commit阶段
第一阶段: before mutation阶段
1. before mutation阶段 -> commitBeforeMutationEffect()
2. commitBeforeMutationEffect()一共会做三件事情, 
  - 第一件事情: 是跟dom的blur和focus相关的操作;
  - 第二件事情: 执行 getSnapshotBeforeUpdate 这个生命周期函数;
  - 第三件事情: 如果当前fiber节点effectTag中包含Passive也就是PassiveEffect, 也就是functionComponent中 用useEffect对应的EffectTag, 那么就调用PassiveEffect对应的回调函数

3. 来看看commitBeforeMutationEffectOnFiber做了什么事情, 这个commitBeforeMutationEffectOnFiber函数实际上是commitBeforeMutationLifeCycles函数as的, 首先这个函数进来先是判断当前fiber节点的tag属性, 如果是class组件, 且已经有组件快照, 那么就调用 getSnapshotBeforeUpdate 这个生命周期, flushPassiveEffect 会执行useEffect的回调函数, 但是在这个逻辑中, 并没有直接执行flushPassiveEffect, 而是作为 scheduleCallback 的回调函数来执行. scheduleCallback会以一个优先级来异步执行一个回调函数, 如果一个functionComponent, 存在useEffect, 并且useEffect的回调函数需要被触发的情况下, 那么这个useEffect的回调, 会在before mutation阶段, 先会以normal的优先级调度, 而整个commit阶段是同步执行的, 所以useEffect的回调函数执行是在commit阶段完成以后, 再异步执行, 这就是整个before mutation执行的工作


useEffect的回调会在before mutation阶段先被normal优先级调度, useEffect

第二阶段: mutation阶段
mutation阶段在 commitMutationEffect这个函数中执行, 这个方法就是一个while循环, 它会遍历包含EffectTag的fiber节点的链表, 遍历到的每一个fiber节点, 首先它会判断是否存在ContentReset, 也就是说是否需要重置文本节点, 接下来会判断是否有ref的更新, 接下来就是mutation阶段最重要的工作, 判断是否有 Placement | Update | Deletion | Hydrating(就是节点的增删改和SSR的操作)
首先如果是 Placement 进入 commitPlacement
进入commitPlacement函数, 如果不支持mutation就直接返回了, 在reactDOM的情况下是支持mutation的, 首先通过``getHostParentFiber``函数, 找到离它最近的Host类型的fiber节点, 这里Host类型包括: HostComponent, HostRoot, HostPortal, FundamentalComponent, 这几种类型都对应有dom节点, 其中HostPortal是React.createPortal创建的;
进入``getHostParentFiber``一直递归向上查找, 直到查到为止
当找到fiber最近的HostParentFiber后, 如果parentFiber存在contentReset, 就要执行resetTextContent, 接下来我们就会找到getHostSibling, 也就是他的host类型的兄弟节点, ``为什么要找它host类型的兄弟节点呢?``, 这是因为我们要插入一个dom节点, 有两种方式, 第一种是执行, insertBefore 方法, 第二种, parentNode.appendChild()方法;
当我们需要执行insertBefore的时候, 我们就需要找到对应的兄弟节点, 如果我们要执行appendChild, 那么我们就需要当前fiber节点的hostParent节点, 我们知道真实的dom节点和对于的fiber节点不是一一对应的, 因为如果有出现ClassComponent节点, 那么这一层节点的Sibling节点, 这是下一个ClassComponent节点的子节点, 假如下一个ClassComponent节点的字节点也是ClassComponent, 就一路往下在, 直到找到HostComponent类型的节点作为这一层的sibling节点,
当执行完commitPlacement()返回后, 当前的dom节点已经插入到页面中了, 接下来就要为当前fiber节点删除这个Placement的EffectTag
当同时存在Placement和Update即 PlacementAndUpdate时, 会先调用Placement对应的方法commitPlacement, 再调用Update对应的方法 commitWork();
- 进入commitWork方法, 首先判断是否支持mutation, 当前的环境是支持mutation, 这里可以先跳过, 然后进入判断fiber的tag, 做不同处理, FunctionComponent和ForwardRef和MemoComponent和SimpleMemoComponent和Block, 这些跟函数式组件相关的类型的处理逻辑是一致的, 会调用commitHookEffectUnmount, 也就是说会调用useLayoutEffect的销毁函数
-进入commitHookEffectUnmount, 它会遍历lastEffect, 先执行所有useLayoutEffect的销毁函数, 如果当前fiber的effect.tag包含传入的tag就直接调用destroy方法
- 当遇到HostComponent也就是dom节点对应的fiber节点时, 它会调用 commitUpdate方法, commitUpdate方法接收的这个参数, updatePayload就是当前节点的updateQueue属性, 我们知道对于属性改变HostComponent对应的节点来说, 它的updateQueue是一个数组, 数组的第i项是key值, 第i+1项是对应的value, 
- 我们来看看commitUpdate方法, 从这里可以看见, 它最终会调用updateProperties, 来更新dom的属性; 这就是update的情况下


接下来我们看看当节点删除的时候的操作, Deletion操作, 会执行commitDeletion,
进入commitDeletion, 如果支持mutation的话, 会执行unmountHostComponents , 我们知道要删除一个dom节点, 要找到这个dom节点的父级dom节点, 所以第一步, 我们要找到, currentParent也是当前fiber的dom节点的父级dom节点, 同样, 这里也会判断 HostComponent HostRoot HostPortal FundamentalComponent, 当我们找到父级dom节点后, 就会执行 commitNestedUnmounts, 当我们删除一个fiber节点时, 这个fiber节点可能包含一棵子树, 这棵子树中的所有子孙fiber节点, 都需要被递归的删除, 所有这个commitNestedUnmounts 就是递归将所有的子树中的fiber节点进行删除操作, 


接下来我们看看classComponent, 当一个fiber节点是一个classComponent类型时会先执行他的 componentWillUnmount 方法, 通过 safeCallComponentWillUnmount , safeCallComponentWillUnmount将当前节点和实例以及


如果是HostComponent类型的fiber会解绑他Ref类型的属性


第三阶段: layout阶段
在上面mutation阶段, 会执行commitMutationEffect这个方法, 在layout阶段会遍历执行 commitLayoutEffect 这个方法, 在Mutation阶段与layout之间还有一句代码需要重点讲解 ``root.current = finishWork``, 在fiber架构双缓存机制时, 当workInProgress的fiber树完成了渲染, 此时fiberRootNode.current指针就会从current的fiber树指向workInProgress的fiber树, 这样workInProgress的fiber树就变成current的fiber树, 而这一步就是``root.current = finishWork``这一行代码做的, 为什么这行代码在mutation阶段之后, layout阶段之前执行呢? 因为在mutation阶段会执行 ``componentWillUnmount`` 这个生命周期函数, 在这个函数中, 我们的current还指向之前的fiber树, 而在``layout``阶段中, 也就是``commitLayoutEffect``中, 我们会调用``componentDidMount``和``componentDidUpdate``, 这两个生命周期函数, 此时current的fiber树已经指向本次更新workInProgress的fiber树

我们接着来看 ``commitLayoutEffects`` 做了什么, 可以看到 ``commitLayoutEffects`` 最重要的 就是调用了 ``commitLayoutEffectOnFiber`` , 并且接下来如果 flag存在ref, 也就是说, 我们的hostComponent或者我们的ClassComponent存在ref属性时, 我们会执行 ``commitAttachRef``, 来处理ref属性
这里layout阶段我们主要看 ``commitLayoutEffectOnFiber`` 做了什么, 这个方法也是来自于 ``commitLifeCycles``, 进入 ``commitLifeCycles`` 这个方法, 当当前的fiber.tag的不同是FunctionComponent和ForwardRef和SimpleMemoComponent和Block时, 就是FunctionComponent的类型是, 它会执行``commitHookEffectListMount``, 这个方法接收的是一个tag, 这个tag是什么呢, 这个tag就是一个 hookLayout也就是 useLayoutEffect 对应的tag, 所以 ``commitHookEffectListMount``在这里针对的是useLayoutEffect对应的effectTag, 他的作用就是遍历执行所有的 ``useLayoutEffect``, 依次执行这些layout的回调函数, 在mutation阶段, 会执行``useLayoutEffect``在上一次的销毁函数; 在layout阶段, 会依次遍历并执行``useLayoutEffect``的create(), 也就是它的回调函数, 所以useLayoutEffect在commit阶段会先执行所有的销毁函数, 接下来 再依次执行所有的回调函数, 而这整个步骤, 都是同步执行的;

接下来会调用 ``schedulePassiveEffect``, ``schedulePassiveEffect``这个函数最重要的是调用了 ``enqueuePendingPassiveHookEffectUnmount``以及``enqueuePendingPassiveHookEffectMount``

先看看``enqueuePendingPassiveHookEffectUnmount``函数, 它是将当前的effect和fiber, push到``pendingPassiveHookEffectUnmount``, 其中第i项是effect, 第i+1想是对应的fiber, 这里的effect就是useEffect的hook对应的effect, 上面函数, 分别useEffect在上一次的销毁函数, 以及在本次的回调函数, push到这两个队列中

当ClassComponent时如果current等于null的情况下, 它会执行instance.componentDidMount(), 如果current不为null的情况下, 就会执行instance.componentDidUpdate函数

再下面会执行 ``commitUpdateQueue``, 在``commitUpdateQueue``会遍历finishQueue的effect, commitUpdateQueue会在ClassComponent的情况下被调用, 第二hostRoot这种情况下调用, 其实对于ClassComponent, 就是对应this.setState()的第二个参数, 也就是他的回调函数, 所以当我们调用this.setState的时候, 传递了第二个参数回调函数时, 他的回调函数会在layout阶段被执行, 对于hostRoot, 也就是说我们执行``reactDOM.render``的第三个参数, 所以当我们首屏渲染时, 我们的页面完成了渲染, 在首屏渲染的阶段, 如果我们的``reactDOM.render``传入了第三个参数, 那么他就在这个时候执行




当我们执行完``commitLayoutEffect``时, 我们的commit阶段的三个子阶段就差不多完成了, 此时nextEffect会赋值为null, 到我们的``rootDoesHavePassiveEffect``存在时, 也就是我们执行``commitLayoutEffects``内部的``commitLayoutEffectOnFiber``下面的对于``FunctionComponent``这个类型, 我们执行了``schedulePassiveEffect``, 在``schedulePassiveEffect``中我们执行了``enqueuePendingPassiveHookEffectUnmount``, 在这个函数中我们将``rootDoesHavePassiveEffect``设置为true, 所以在我们的commit阶段的最后, 如果我们本次更新存在useEffect的回调, 那么这个参数就是true, 如果是true的话``rootWithPendingPassiveEffect``这个全局变量就赋值整个应用的根节点root, 

那么这个``rootWithPendingPassiveEffect``有什么用处呢? 我们回到commit阶段的起点, 在``commitBeforeMutationEffect``也就是 before mutation 阶段, 我们会判断是否存在Passive, 也就是是否存在useEffect对应的effectTag, 如果存在的话, 我们会调度一个回调函数, 这个回调函数在commit阶段完成以后 会异步的执行, 也就是上面``scheduleCallback``里面的那个回调函数 ``flushPassiveEffect``

我们看看``flushPassiveEffects``回调中做了什么, 它内部会执行``flushPassiveEffectImpl``, 这个回调函数中, 首先就会判断``rootWithPendingPassiveEffect``是否为null, 如果为null直接返回false, 而``rootWithPendingPassiveEffect``在我们的layout完成时, 已经变成了true, 然后下面它会遍历我们上面``pendingPassiveHookEffectUnmount``的这个数组, 也就是保存useEffect销毁函数的数组, 遍历它并依次执行对应的销毁函数, 接下来会遍历``pendingPassiveHookEffectsMount``, 也就是保存我们useEffect回调函数的数组, 接下来我们遍历这个数组并依次执行, 每一个回调函数, 所以我们可以看到, ``flushPassiveEffects``这个方法的目的: 就是执行useEffect在上一次更新的销毁函数以及在本次更新的回调函数 


再一次回到整个commit阶段的起点, ``commitRootImpl()`` 在commitRoot的起点, 会通过一个do while来循环调用``flushPassiveEffect()``, 这里就解答我们之前的疑问, 在本次commit阶段开始之前, 我们需要先处理之前遗留的useEffect, 所以我们需要遍历执行``flushPassiveEffect``, 由于在我们的useEffect内部才能触发新的更新, 而新的更新有可能触发新的副作用, 所以我们这里循环遍历``flushPassiveEffect``, 直到我们的``rootWithPendingPassiveEffect``等于null才能跳出这个循环, 就是知道所有的useEffect没有遗留的回调函数时, 再执行本次commit阶段


对比useEffect和useLayoutEffect
before mutation阶段
useEffect         调度 flushPassiveEffect
useLayoutEffect   没有

mutation阶段
useEffect         没有
useLayoutEffect   执行destroy

layout阶段
useEffect         注册destroy和create
useLayoutEffect   执行create

commit阶段完成后
useEffect         执行flushPassiveEffect
useLayoutEffect   无

在进入commit阶段以后, 在before mutation阶段 useEffect会调度 ``flushPassiveEffect``这个回调函数, 这个函数会在整个commit阶段完成以后再异步执行

在mutation节点 useLayoutEffect会执行销毁函数
在layout阶段 useEffect会注册destroy函数和本次的回调函数, 而useLayoutEffect会layout节点会执行本次的回调函数

当commit阶段完成以后, 在before mutation调度的flushPassiveEffect会被执行, 在这个函数内部, 会遍历在layout阶段注册的销毁函数以及本次的回调函数并依次执行他们, 可以看到useLayoutEffect会在会在mutation阶段和layout阶段依次执行 destroy函数和回调函数, 而useEffect会在整个commit阶段完成以后再异步调用所有的销毁函数和回调函数

看下面的经典的例子
```js

const App=()=>{
  const [count, setCount] = React.useState(0);
  React.useLayoutEffect(() => {
    if (count === 0) {
      const randomNum = 10 + Math.random() * 200;
      const now = performance.now();
      while (performance.now() - now < 100) {}
      setCount(randomNum) ;
    }
  }, [count]);
  return (
    <div onClick={() => setCount(0)}>{count}</div>
  );
}
ReactDOM.render(<App/>, document.getElementById('app'));

```

如果我点击count就会首先会变为0, 人为的阻塞100ms, 再随机生成一个count, 我们可以看到, 页面是不会有0这个情况出现的, 因为销毁上一次更新和执行本次useLayoutEffect函数是同步执行的, 当执行到setCount(0)时, 然后立即进入useLayoutEffect回调函数, 然后页面阻塞了100ms再执行了setCount此时由于useLayoutEffect在commit阶段是同步的原因, 所以, 是看不到setCount(0)这个中间值的, 直接会被合并到随机值里面, 而useEffect因为是在commit阶段完成后, 在异步调用对应的销毁函数和灰度函数, 所以就会有出现setCount(0)这个中间值




## react的diff算法
diff算法的入口是``reconcileChildFibers``, 里面首先它会判断当前这个newChild是否为Fragment类型, 然后判断是否为object, 如果是object的话, 就有可能是reactElementType. reactPortal, 或者是ReactLazyComponent这三种类型, 接下来会判断是否是string, 或者number, 这两种情况下就会当成singleTextNode文本节点处理 , 是否是Array是否是Iterate, 这时候就会分为单一节点和多节点的diff算法

#### 单一节点算法
什么是单一节点算法

```js
const App=()=>{
  const [count, setCount] = React.useState(0);
  const a = (
    <div>
      <p>a</p>
      <h1>b</h1>
    </div>
  )
  const b = (
    <div>
      <h1>b</h1>
      <p>a</p>
    </div>
  )
  return (
    <div onClick={() => setCount(count + 1)}>{
      count % 2 ? a : b
    }</div>
  );
}
ReactDOM.render(<App/>, document.getElementById('app'));
```

看上面例子来说, 这个div节点在更新之后, 这一级只存在一个div节点, 所以对于这个div来说就是一个单节点的diff,  所以单一fiber节点最终还是会生成一个新的fiber节点并返回








