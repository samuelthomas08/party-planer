import Dashboard from './Dashboard/Dashboard';

import { useNavigate } from "react-router-dom";

import { db } from './firebase/firebase';

import { collection, query, where, doc, getDoc } from 'firebase/firestore';
import { useEffect, useState } from 'react';

const App = () => {
  const navigate = useNavigate();

  const [loginState, setLoginState] = useState();
  useEffect(() => {
    const fetchData = async () => {
        const q = query(doc(db, "login", "info"));

        const querySnapshot = await getDoc(q);

        setLoginState(querySnapshot.data().loginState);

        if(querySnapshot.data().loginState == false) {
          navigate('/login');
        }
    }       

    fetchData()        
}, []);
  return (
    <div className="App"> 
      {loginState ? <Dashboard /> : <h1>Du bist nicht angemeldet</h1>}
    </div>
  );
}

export default App;
