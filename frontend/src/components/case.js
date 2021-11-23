import React, {Component} from 'react';

class Case_details extends Component {
 state = {
   json_response: []
 };

 url = 'http://127.0.0.1:8000/api/cases/'



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

  

 render() {
         
    return (
        <div>
            <p>Data from parent is:{this.props.dataFromParent}</p>
            
        </div>
    );
 }
}

export default Case_details ;
