var isFirstRender = false; // 标记是否首次渲染
var isWorkIng = false
var isCommitting = false
/**定义fiber的tag集合 */
let HostRoot = 'HostRoot'; // 标识RootFiber类型, 就是在首次创建fiber时同时创建的workInProgress
let ClassComponent = 'ClassComponent'; // 表示类组件的类型
let HostComponent = 'HostComponent'; // 表示原生标签类型
let HostText = 'HostText'; // 表示文本类型
let FunctionComponent = 'FunctionComponent'; // 表示函数组件类型


/**定义effectTag的集合 */
let Placement = 'Placement'; // 表示这个节点是新插入(当然首次渲染的workInProgress也是标记这样)
let Update = 'Update'; // 当前节点有更新;
let Deletion = 'Deletion'; // 当前节点被删除
let PlacementAndUpdate = 'PlacementAndUpdate'; // 表示即插入又进行了更新
let NoWork = 'NoWork'; // 表示当前节点没有任何操作

let ifError = ( function(){
  // 自定义的函数, 防止卡死
  let _name = '';
  let _time = '';
  return function (name, time) {
    _name = _name !== name ? name : _name;
    _time++;
    if (_time >= time) {
      throw `${name}函数执行的次数超过了${time}次`
    }

  }
})()

/**定义事件合成事件的名字 */
let eventsName = {
  onClick: 'click',
  onChange: 'change',
  onInput: 'input'
}

// 这里定义fiber数据结构
class FiberNode {
  // 每次创建fiber, 都需要指定创建的类型; 以及我们传进去的props, key等之类的属性, 注意这里的属性是即将要被挂载的属性
  constructor(tag, key, pendingProps) {
    this.tag = tag; // 表示当前fiber的类型; 比如说: (1):div是一个HostComponent类型; (2):标签里面的值是文本类型; (3):还有我们的自定义组件的类型包括class和函数类型
    this.key = key;
    this.type = null; // 表示当前fiber是  'div' | 'h1' | 'span' | App(这里是自定义组件)
    this.stateNode = null; // 表示当前fiber的实例, 在插入过程创建实例如果是普通的元素, 就是直接生成 , 如果是自定义组件那么就是使用new操作符进行生成
    this.child = null; // 表示当前fiber的子节点, 这里注意不是children而是单个的child, 这里的child指向的是当前fiber的第一个子节点firstChild
    this.sibling = null; // 表示当前节点的兄弟节点, 有且只有一个属性指向隔壁的兄弟节点
    this.return = null; // 表示当前节点的父节点
    this.index = 0; // 假如是数组类型的子节点的话每个fiber都会给一个index
    this.memoizedState = null; // 表示当前fiber的state, 如果当前fiber是class, 用来保存组件的state
    this.memoizedProps = null; // 表示当前fiber的props, 这里要注意, 他这里有一个旧状态, 我们传进来的pendingProps是一个新状态
    this.pendingProps = pendingProps; // 表示新的props
    this.effectTag = null; //表示当前节点要进行何种更新, 这个更新是怎么标识的呢看上面<定义effectTag的集合>

    // 如果不是新这里会有新的fiber以链表形式挂载到RootFiber上面
    this.firstEffect = null; // 表示当前的节点有更新的第一个子节点
    this.lastEffect = null; // 表示当前节点有更新的最后一个子节点
    // firstEffect和lastEffect两个是链表, 表示后一个节点的firstEffect指向了前一个节点的firstEffect

    this.nextEffect = null; // 表示下一个要更新的子节点

    this.alternate = null; // 表示fiber用来连接current和alternate, 每个fiber都可以通过alternate找到对应的current
    this.updateQueue = null; // 这里也是一条链表, 表示挂载当前fiber的最新的状态, 比如说一个操作有多个setState操作, 那么每一个setState都会挂载到这里, 直到最后一个更新

  }
}

function createFiber(tag, key, pendingProps) {
  return new FiberNode(tag, key, pendingProps)
}

function createWorkInProgress(current, pendingProps) {
  // 这里的workInProgress复用的current的alternate
  let workInProgress = current.alternate;
  if (!workInProgress) {
    workInProgress = createFiber(current.tag, pendingProps, current.key);
    workInProgress.type = current.type;
    workInProgress.stateNode = current.stateNode;
    workInProgress.alternate = current;
    current.alternate = workInProgress;
  } else {
    workInProgress.pendingProps = pendingProps;
    workInProgress.effectTag = NoWork;
    workInProgress.firstEffect = null;
    workInProgress.lastEffect = null;
    workInProgress.nextEffect = null;
  }
// 要保证current 和current.alternate.上的updateQueue是同步的
// 因为每次执行setState时 候会创建新的更新把更新挂载到组件对应的fiber.上
// 这个fiber在奇数次更新时存在于current树上在偶数次更新时存在于current .alternate
// 咱们每次创建(或复用)workInProgress是从current.alternate 上拿的对象
// 复用的这个alternate上updateQueue. 上不一定有新的更新
// 所以这里要判断如果current.alternate 上没有新的更新的话就说明本轮更新
// 找到的这个fiber存在于current树上

if (
  !!workInProgress &&
  !!workInProgress.updateQueue &&
  !workInProgress.updateQueue.lastEffect
  ) {
    workInProgress.updateQueue = current.updateQueue
  }
  workInProgress.child = current.child
  workInProgress.memoizedState = current.memoizedState
  workInProgress.memoizedProps = current.memoizedProps
  workInProgress.sibling = current.sibling
  workInProgress.index = current.index
  return workInProgress
}

function completeWork(workInProgress) {
  // 1. 创建真实的DOM实例
  let  tag = workInProgress.tag; // 获取当前节点是什么类型 原生dom元素还是自定义组件
  let instance = workInProgress.stateNode; // 获取当前实例, 首次渲染肯定是没有这个东西的
  if (tag === HostComponent) {
    if (!instance) {
      // 没有实例说明初次渲染, 也可能是一个新创建的一个节点
      let domElement = document.createElement(workInProgress.type);
      domElement._reactInternalInstance = workInProgress
      workInProgress.stateNode = domElement; // 将创建的dom实例挂载到stateNode中

      // 2. 对子节点进行插入
      let node = workInProgress.child;
      warper: while (!!node) {
        let tag = node.tag;
        if (tag === HostComponent || tag === HostText) {
          domElement.appendChild(node.stateNode)
        } else {
          node.child.return = node; // 将指针往下移
          node = node.child
          continue
        }
        if (node === workInProgress) break
        while (node.sibling === null) {
          if (node.return === null || node.return === workInProgress) {
            break warper
          }
          node = node.return
        }
        node.sibling.return = node.return;
        node = node.sibling
      }
      // 3. 把属性给他
      let props = workInProgress.pendingProps;
      for (const propKey in props) {
        if (Object.hasOwnProperty.call(props, propKey)) {
          let propValue = props[propKey];
          if (propKey === 'children') {
            if (typeof propValue === 'string' || typeof propValue === 'number') {
              domElement.textContent = propValue
            }
          } else if (propKey === 'style') {
            for (const stylePropKey in propValue) {
              if (Object.hasOwnProperty.call(propValue, stylePropKey)) {
                const stylePropValue = propValue[stylePropKey].trim();
                if (stylePropKey === 'float') {
                  stylePropKey = 'cssFloat'
                }
                domElement.style[stylePropKey] = stylePropValue
              }
            }
          } else if (eventsName.hasOwnProperty(propKey)) {
            let event = props[propKey];
            // react所有写在jax模板上的事件都是合成事件
            // 合成事件不会立即执行传进来的函数
            // 而是执行一些其他的东西
            // 比如说事件源对象的一些处理进行合成
            // 会把你所有的事件都带到根节点上, 好处, 全局只用绑定一个事件, 减少
            // 内部也会阻止默认事件的机制
            domElement.addEventListener(eventsName[propKey], event, false)
          } else {
            domElement.setAttribute(propKey, propValue)
          }
        }
      }
    }
  } else if (tag === HostText) {
    let oldText = workInProgress.memoizedProps;
    let newText = workInProgress.pendingProps;
    if (!!instance) {
      instance = document.createTextNode(newText);
      workInProgress.stateNode = instance
    } else {
      // 说明不是初次渲染
    }
  }
}

function completeUnitOfWork(workInProgress) {
  while (true) {
    var returnFiber = workInProgress.return;
    var siblingFiber = workInProgress.sibling;

    // 1. 创建真实的DOM实例
    // 2. 对子节点进行插入
    // 3. 把属性给他
    completeWork(workInProgress)

    // 先判断当前节点是否有更新
    let effectTag = workInProgress.effectTag;
    let hasChange = (
      effectTag === Update ||
      effectTag === Deletion ||
      effectTag === Placement ||
      effectTag === PlacementAndUpdate
    )
    if (hasChange) {
      if (!!returnFiber.lastEffect) {
          returnFiber.lastEffect.nextEffect = workInProgress
      } else {
        returnFiber.firstEffect = workInProgress
      }
      returnFiber.lastEffect = workInProgress
    }
    // if (!!returnFiber) {
    //   if (returnFiber.firstEffect === null) {
    //     returnFiber.firstEffect = workInProgress
    //   }
    // }

    if (!!siblingFiber) return siblingFiber
    if (!!returnFiber) {
      workInProgress = returnFiber;
      continue
    }
    return null;
  }
}

function reconcileSingleElement(returnFiber, element) {
  let type = element.type
  let flag = null;
  if (element.$$typeof === Symbol.for('react.element')) {
    // 判断是否为一个合格的react元素
    if (typeof type === 'function') {
      // 这里是继承了React.Component就有的
      if (type.prototype && type.prototype.isReactComponent) {
        flag = ClassComponent
      }
    } else if (typeof type === 'string') {
      // 可能是dom类型
      flag = HostComponent
    }
    // 判断完就可以创建fiber了
    let fiber = new FiberNode(flag, element.key, element.props)
    fiber.type = type;
    fiber.return = returnFiber
    return fiber
  }
  // return null; // 啥也不是就返回null
}

function reconcileStringTextNode(workInProgress, nextChildren) {
  // debugger
  // 判断完就可以创建fiber了
  let fiber = new FiberNode(HostText, null, nextChildren)
  fiber.return = workInProgress
  fiber.stateNode = nextChildren;
  return fiber
}

function reconcileChildrenArray(workInProgress, nextChildren) {
  // 这个方法中要通过index和key值, 去尽可能的多找点复用的dom节点
  // 这个方法中是react最复杂的方法
  // debugger
  let nowWorkInProgress = null;
  if (isFirstRender) {
    nextChildren.forEach((reactElement, index) => {
      if (index === 0) { // 对于数组子节点返回的第一个元素使用reconcileSingleElement创建fiber, 赋值给父节点的child
        // 如果子节点是一个单独的string或者是number, 进行单独处理
        if (typeof reactElement === 'string' || typeof reactElement === 'number') {
          workInProgress.child = reconcileStringTextNode(workInProgress, reactElement)
        } else {
          workInProgress.child = reconcileSingleElement(workInProgress, reactElement);
        }
        nowWorkInProgress = workInProgress.child; // 保存第一个子节点的child; 用作后面子节点的sibling
      } else {
        if (typeof reactElement === 'string' || typeof reactElement === 'number') {
          nowWorkInProgress.sibling = reconcileStringTextNode(workInProgress, reactElement)
        } else {
          nowWorkInProgress.sibling = reconcileSingleElement(workInProgress, reactElement);
        }
        nowWorkInProgress = nowWorkInProgress.sibling
      }
    })
    return workInProgress.child
  }
}

function reconcileSingleTextNode(returnFiber, text) {
  let fiber = createFiber(HostText, null, text);
  fiber.return = returnFiber;
  return fiber;

}

function reconcileChildFiber(workInProgress, nextChildren) {
  // 判断 原生dom元素还是组件以及 原生dom类型的数组还是组件数组
  if (typeof nextChildren === 'object' && !!nextChildren && !!nextChildren.$$typeof) {
    // 一个react组件
    return reconcileSingleElement(workInProgress, nextChildren)
  }
  
  if (nextChildren instanceof Array) {
    // 如果有多个子节点
    return reconcileChildrenArray(workInProgress, nextChildren)
  }

  if (typeof nextChildren === 'string' || typeof nextChildren === 'number') {
    // 原生节点
    return reconcileSingleTextNode(workInProgress, nextChildren)
  }

  // 如果什么都不是, 就传错了
  return null
}

let classComponentUpdater = {
  enqueueSetState() {

  }
}

// 循环每个子节点, 生成fiber并且返回当前workInProgress的子节点
function reconcileChildren(workInProgress, nextChildren) {
  workInProgress.child = reconcileChildFiber(workInProgress, nextChildren);
  if (isFirstRender && !!workInProgress.alternate) {
    // 判断是否是第一次渲染, 且是否有alternate, 需要添加初次渲染的标志位Placement
    workInProgress.child.effectTag = Placement;
  }
  return workInProgress.child
}

function updateHostRoot(workInProgress) {
  let children = workInProgress.memoizedState.element; // 获取到HostRoot的

  // 定义外部方法创建fiber
  return reconcileChildren(workInProgress, children);

}

function updateClassComponent(workInProgress) {
  // 对于class组件类型
  let component = workInProgress.type; // class的component
  let nextProps = workInProgress.pendingProps; // 获取即将传进去的props

  // 合并默认的props
  if (!!component.defaultProps) {
    nextProps = Object.assign({}, component.defaultProps, nextProps)
  }

  // 是否更新
  let shouldUpdate = null;
  let instance = workInProgress.stateNode;
  if (!instance) {
    // 没有实例, 说明是初次渲染才
    // 传三个参数, 第二个是context上下文, 15版本后已废弃
    instance = new component(nextProps, null, null)
    workInProgress.memoizedState = instance.state; // 当前fiber的memoizeState指向当前实例的状态
    workInProgress.stateNode = instance;
    // 让实例和fiber有个指向
    instance._reactInternalFiber = workInProgress;
    instance.updater = classComponentUpdater; // 这个classComponentUpdater对象里面是包含react的setState方法;

    // getDerivedStateFromProps这是一个新的生命周期用来代替componentWillReceiveProps;
    // 一个新的生命周期方法, 这个getDerivedStateFromProps是一个静态方法, 只能在component上获取, 无法在实例上获取,
    // getDerivedStateFromProps要返回新的状态对象或者返回null, 里面的方法就是合并props的作用
    let getDerivedStateFromProps = component.getDerivedStateFromProps;
    if (!!getDerivedStateFromProps) {
      let prevState = workInProgress.memoizedSate;
      let newState = getDerivedStateFromProps(nextProps, prevState); // 返回的是一个新的状态对象
      if (!(newState !== null || newState !== undefined)) { // 如果返回新的状态对象不是空
        if (typeof newState === 'object' && !(newState instanceof Array)) { // 且是一个对象
          // 将即将传进来的props和合并后的state进行合并, 并赋值给当前workInProgress的memoizeState;
          workInProgress.memoizedState = Object.assign({}, nextProps, newState)
        }
      }
      // 将workInProgress 的state值赋值给实例上
      instance.state = workInProgress.memoizedSate;

      shouldUpdate = true
      // 接下来就是处理生命周期的问题了

    }

  } else {
    // 如果有实例就是初次渲染
  }

  // 上面处理完state和props后就开始创建fiber
  let nextChild = instance.render(); // 这里调用render后的返回值的结构如下
  /*
  let element = {
    $$typeof: REACT_ELEMENT_TYPE,
    type, // 组件的类型, APP / 'div' / 'span'
    key,
    props,
  }
  */



  // 定义外部方法创建fiber
  return reconcileChildren(workInProgress, nextChild);
}

function updateHostComponent(workInProgress) {
  // 首先第一步都要拿到他的属性
  let nextProps = workInProgress.pendingProps;

  // 第二步: 获取他的children, 并生成children的fiber
  let nextChildren = nextProps.children;
  // 注意. 对于文本类型的节点不一定每次都会创建节点
  // 什么情况下会创建fiber呢? 当这个节点有兄弟节点的时候会创建对应的fiber; 当它是独生子的时候, 不会创建fiber. 直接返回null

  if (typeof nextChildren === 'string' || typeof nextChildren === 'number') {
    return null;
  }
  return reconcileChildren(workInProgress, nextChildren);
}

function beginWork(workInProgress) {
  // 循环创建fiber
  let tag = workInProgress.tag;
  let next = null;
  if (tag === HostRoot) {
    next = updateHostRoot(workInProgress)
  } else if (tag === ClassComponent) {
    next = updateClassComponent(workInProgress)
  } else if (tag === HostComponent) {
    next = updateHostComponent(workInProgress)
  } else if (tag === HostText) { // 这里属于文本类型是没有子节点的 , 直接返回null
    next = null
  }
  return next;
}

function performUnitOfWork(workInProgress) {
  // beginWork的目的就是根据传进去等的这个workInProgress
  // 生成他子节点的fiber
  let next = beginWork(workInProgress); // 这里的next就是子节点的fiber
  if (next === null) {
    next = completeUnitOfWork(workInProgress)
  }
  return next;
}
let nextUnitOfWork = null;

// 循环创建fiber树
function workLoop(nextUnitOfWork) {
  while (!!nextUnitOfWork) {
    nextUnitOfWork = performUnitOfWork(nextUnitOfWork)
  }
}


// commit阶段, 提交这课树的方法
function commitRoot(root, finishedWork) {
  isWorkIng = true;
  isCommitting = true;
  // 有三个while循环
  // 第一个while循环用来执行 getSnapshotBeforeUpdate
  // 第二个函数 真正用来操作页面 将有更新节点, 进行插入 / 删除 / 更新操作
  // while() {

  // }
  // 执行剩下的生命周期

  let firstEffect = finishedWork.firstEffect;
  let nextEffect = null;


  nextEffect = firstEffect
  while (!!nextEffect) {
    ifError('第二次循环', 50);
    let effectTag = nextEffect.effectTag;
    if (effectTag.indexOf(Placement) > -1) {
      // 说明节点是新插入的
      // 1. 先找到能被插入的父节点
      // 2. 再往父节点插入子节点
      let parentFiber = nextEffect.return;
      let parent = null;
      while(!!parentFiber) {
        let tag  = parentFiber.tag;
        if (tag === HostComponent || tag === HostRoot) {
          break
        }
      }
      if (parentFiber.tag === HostComponent) {
        parent = parentFiber.stateNode;
      } else if (parentFiber.tag === HostRoot) {
        parent = parentFiber.stateNode.container;
      }
      if (isFirstRender) {
        let tag  = nextEffect.tag;
        if (tag === HostComponent || tag === HostText) {
          parent.appendChild(nextEffect.stateNode)
        } else {
          let child = nextEffect.child
          while (true) {
            ifError('第二次循环', 50);
            let tag = child.tag;
            if (tag === HostComponent || tag === HostText) {
              break
            }
            child = child.child
          }
          parent.appendChild(child.stateNode)
        }
      }
    } else if (effectTag === Update) {
      // 说明属性上有更新

    } else if (effectTag === Deletion) {
      // 
    } else if (effectTag === PlacementAndUpdate) {
      // 
    }
  }
  nextEffect = firstEffect
  nextEffect = firstEffect
  isWorkIng = false
  isCommitting = false
}

function completeRoot(root, finishedWork) {
  root.finishedWork = null;
  commitRoot(root, finishedWork) 
}

class ReactRoot {
  constructor(container) {
    this._internalRoot = this._createRoot(container); // 使用内部方法调用
  }
  _createRoot(container) {
    // 在创建root的时候同时创建一个 uninitialFiber
    let uninitialFiber = this._createUninitialFiber(HostRoot, null, null); // 初始化的fiber
    let root = {
      container,
      current: uninitialFiber, // 一个是current树
      finishedWork: null, // 指向workInProgress
    }
    uninitialFiber.stateNode = root;
    return root
  }
  _createUninitialFiber(tag, key, pendingProps) {
    return createFiber(tag, key, pendingProps); // 返回一个创建fiber的方法, 这个是一个外部方法, 因为每个节点都需要创建fiber, 所以需要将其定义在全局中
  }
  render(reactElement, cb) {
    // 每次更新都是从root开始遍历的
    // 从构造器中获取root
    let root = this._internalRoot;
    let workInProgress = createWorkInProgress(root.current, null)
    workInProgress.memoizedState = { // 在HostRoot类型的组件中, 定义子组件
      element: reactElement
    }
    nextUnitOfWork = workInProgress
    // 开始循环生成fiber
    workLoop(nextUnitOfWork);
    root.finishedWork = root.current.alternate
    if (!!root.finishedWork) {
      completeRoot(root, root.finishedWork)
    }

  } 
}

const ReactDOM = {
  // index文件调用的render函数
  render(reactElement, container, cb) {
    isFirstRender = true;
    let root = new ReactRoot(container); // 第一步创建root
    container._reactRootContainer = root;
    root.render(reactElement, cb); // 这里调用的是ReactRoot里面的render
    isFirstRender = false; // 最后将首次渲染的标记重置
  }
}
export default ReactDOM
