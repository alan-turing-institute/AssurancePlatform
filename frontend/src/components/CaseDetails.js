import React, {Component} from 'react';
import GoalDetails from "./GoalDetails.js"

class CaseDetails extends Component {
 state = {
   json_response: []
 };

 url = 'http://localhost:8000/api/cases/'


/*
 async componentDidMount() {
   try {

    const res = await fetch(this.url + 1); // fetching the data from api, before the page loaded
     const json_response = await res.json(); //getting the json response
     console.log(json_response)
     this.setState({
       json_response
     });

   } catch (e) {
     console.log(e);
   }
 }
*/


 render() {

     return (
	 <li>
             {this.props.acase.name}
	     {this.props.acase.description}
	 </li>
    );
 }
}

export default CaseDetails ;
