// import React from 'react';
import React from './react/react';
// import ReactDOM, {flushSync} from 'react-dom';
import ReactDOM from './react-dom/react-dom';
class Xing2 extends React.Component {
  // constructor() {
  //   super()
  // }
  render(h) {
    return (
      <div>xing2</div>
    )
  }
}
class Xing extends React.Component {
  state = {
    a: 0
  }
  handleFun = () => {
    console.log(12312)
    // setTimeout(() => {
    //   this.setState({
    //     a: 444
    //   })
    //   console.log(this.state.a)
    // })
    // flushSync(() => {
    //     this.setState({
    //       a: 444
    //     })
    // })
    // console.log(this.state.a)
    window.a++
    this.setState({
      a: window.a
    })
  }
  constructor(props) {
    super(props);
    if (!window.a) {
      window.a = 0;
    }
  }
  render() {
    return (
      <div onClick={this.handleFun}>
        <h1 color="#111">abc</h1>
        <Xing2 />
        <h2>
          123
          <p>456</p>
        </h2>
        <h3>
          <span></span>
        </h3>
      </div>
    )
  }
}
ReactDOM.render(<Xing prop1={666} key='789' />, document.getElementById('root'));