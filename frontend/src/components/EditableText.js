import { Form, TextInput } from "grommet";
import React, { Component } from "react";
import { useParams } from "react-router-dom";

class EditableText extends Component {
  // A text input box component that renders as an ordinary looking text box, but is
  // editable. An onSubmit function can be provided as a prop, and it will be called with
  // the value of the text box when the user hits enter or the text box loses focus.

  constructor(props) {
    super(props);
    this.textInputRef = React.createRef();
    this.state = {
      value: props.initialValue,
    };
  }

  onChange(event) {
    this.setState({ value: event.target.value });
  }

  onSubmit(event) {
    // Make the TextInput component lose focus, if it has focus.
    this.textInputRef.current.blur();
    this.props.onSubmit(this.state.value);
  }

  render() {
    return (
      <Form
        onSubmit={this.onSubmit.bind(this)}
        // Any time the form loses focus, we should submit, to avoid losing edits.
        onBlur={this.onSubmit.bind(this)}
      >
        <TextInput
          style={this.props.style}
          ref={this.textInputRef}
          plain={true}
          size={this.props.textsize}
          onChange={this.onChange.bind(this)}
          value={this.state.value}
        />
      </Form>
    );
  }
}

export default (props) => <EditableText {...props} params={useParams()} />;
