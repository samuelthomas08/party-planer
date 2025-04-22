import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

import Login from './Login/Login';

import { createBrowserRouter, RouterProvider } from 'react-router-dom';

import './_basic.sass';
import NewEquipment from './NewEquipment/NewEquipment';
import UpdateEquipment from './UpdateEquipment/UpdateEquipment';
import UpdatePlace from './UpdatePlace/UpdatePlace';
import NewPlace from './NewPlace/NewPlace';
import PlaceRO from './PlaceRO/PlaceRO';


const router = createBrowserRouter([
  {path:"/", element: <App />},
  {path:"/login", element: <Login />},
  {path:"/new-equipment", element: <NewEquipment />},
  {path:"/update-equipment/:id", element: <UpdateEquipment />},
  {path:"/new-place", element: <NewPlace />},
  {path:"/place/:id", element: <PlaceRO />},
  {path:"/update-place/:id", element: <UpdatePlace />}
]);



const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>
);
