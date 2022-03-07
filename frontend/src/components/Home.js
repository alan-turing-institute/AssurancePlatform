import { Box, Heading } from 'grommet';
import React from "react"
import { Link } from 'react-router-dom';
class Home extends React.Component {

  handleChange() {
    console.log("hello")
  }

  render() {
    return (
      <Box pad="small" margin="medium">
        <Heading level={2}>Ethical Assurance Platform</Heading>
        <Link to="/case/select">Select an existing case</Link>
        <Link to="/case/new">Create a new case</Link>
      </Box>
    )
  }


}

export default Home;
