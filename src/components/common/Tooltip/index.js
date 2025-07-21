import React from 'react';
import './index.css'; 

const Tooltip = React.forwardRef((props, ref) => (
  <div ref={ref} className="tooltip" />
));

export default Tooltip;