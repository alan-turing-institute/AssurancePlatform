import React, {Component} from 'react';

class GoalDetails extends Component {
 state = {
   json_response: []
 };

 url = 'http://localhost:8000/api/goals/'




 render() {

     return (
	 <li>
             {this.props.agoal.name}
	     {this.props.agoal.short_description}
	     {this.props.agoal.short_description}
	 </li>
    );
 }
}

export default GoalDetails ;
