import React from "react"
import { Link } from 'react-router-dom';
class Home extends React.Component {

handleChange() {
   console.log("hello") 
}

render() {
  return (
    <div>
        <h2>Ethical Assurance Platform</h2>
        <li>
        <Link to="/case/select">Select an existing case</Link>
        </li>
        <li> 
        <Link to="/case/new">Create a new case</Link>
        </li>
        <li> 
        <Link to="/goal/new">Create a new goal</Link>
        </li>
    </div> 
  )  
}


}

export default Home;