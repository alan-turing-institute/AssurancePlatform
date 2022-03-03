import React from "react"
import { Link } from 'react-router-dom';

import { Grid, Box, Anchor, Text, DropButton, Menu, TextInput, Layer, Button } from 'grommet';
import { grommet } from 'grommet/themes';
import { Attraction, Car, Add } from 'grommet-icons';
import { deepMerge } from 'grommet/utils';


class Home extends React.Component {

  handleChange() {
    console.log("hello")
  }
  click(textid) {
    if (textid == "New Case") {
      console.log("I am in")
    }
    console.log(textid)
  }




  render() {
    return (
      <div >
        <Grid
          rows={['flex', 'xxsmall']}
          columns={['flex']}
          gap="medium"
          areas={[
            { name: 'main', start: [0, 0], end: [0, 0] },
            { name: 'footer', start: [0, 1], end: [0, 1] },
          ]}>

          {/* main box */}
          <Box gridArea="main" background="light-2">
            <Box pad={{ horizontal: '20%', vertical: '10%' }} >
              <Grid columns="small" gap="medium">
                {[
                  'New Case',
                  'Template 1',
                  'Template 2',
                  'Template 3',
                  'Template 4',
                  'Template 5',
                ].map((text) => (
                  <Box
                    key={text}
                    pad="large"
                    background={{ color: 'dark-2', opacity: 'strong' }}
                    round gap="small"
                    align="center"
                    onClick={() => { this.click(text) }}
                  >
                    {text}
                  </Box>
                ))}
              </Grid>
            </Box>


            {/* footer */}
            <Box gridArea="footer" background="light-5" />

            <li>
              <Link to="/case/select">Select an existing case</Link>
            </li>
            <li>
              <Link to="/case/new">Create a new case</Link>
            </li>


          </Box>

          {/* <Box direction="column" gap={'40px'} gridArea="right" background={{ color: "#ff0000" }}>

          </Box> */}


        </Grid>
      </div >
    )
  }


}

export default Home;
