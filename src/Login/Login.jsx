import './Login.sass';


import { db } from '../firebase/firebase';

import { collection, query, where, doc, getDoc, setDoc } from 'firebase/firestore';
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

const Login = () => {

    const navigate = useNavigate();

    const [password, setPassword] = useState('');
    const [failedLogin, setFailedLogin] = useState(false);
    const passInputRef = useRef();

    useEffect(() => {
        const fetchData = async () => {
            const q = query(doc(db, "login", "info"));

            const querySnapshot = await getDoc(q);
            
            setPassword(querySnapshot.data().password);
        }       
        fetchData();
        
        passInputRef.current.value = localStorage.getItem("password");
    }, []);

    const handleLoginValidation = async () => {
        if(passInputRef.current.value != password) {
            setFailedLogin(true);
        } else if (passInputRef.current.value == password) {
            setFailedLogin(false);

            await setDoc(doc(db, "login", "info"), {
                loginState: true,
                password: password
            });

            localStorage.setItem("password", password);

            navigate('/');
        }
    }

    return (
        <div className="Login">
            <h1>Party Planer</h1>

            <div className="login-container">
                <p>Admin-Passwort</p>
                <input className={failedLogin ? 'failed' : ''} ref={passInputRef} type="password" placeholder="Passwort..." />

                <button className="login-btn" onClick={handleLoginValidation}>Login</button>
                {failedLogin ? <p className='wrong-pass-text'>Falsches Password</p> : ''}
            </div>
        </div>
    );
}

export default Login;