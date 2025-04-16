import './EquipmentItem.sass';

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPenToSquare, faTrashAlt } from '@fortawesome/free-solid-svg-icons';

import { db } from '../../../firebase/firebase';
import { doc, deleteDoc } from 'firebase/firestore';

const EquipmentItem = ({ title, imgs, category, titleId, equipmentList, setEquipmentList, description }) => {

    const deleteEquipmentHandler = async () => {
        console.log(titleId);

        await deleteDoc(doc(db, "equipment", titleId));

        setEquipmentList(equipmentList.filter(equipment => equipment.titleId !== titleId));
    }

    return (
        <div>
            <div className="EquipmentItem">
                <p className="category">{ category == 0 ? 'Ständer' : 'Anderes' }</p>
                <FontAwesomeIcon onClick={deleteEquipmentHandler} className='delete' icon={faTrashAlt} />

                <div>
                    {category == 0 ? <div className="img-container">
                        {imgs.topBarAdd != null ? <img className='top-bar-add' src={imgs.topBarAdd} /> : null}
                        {imgs.topBar != null ? <img className='top-bar' src={imgs.topBar} /> : null}
                        {imgs.foot != null ? <img className='foot' src={imgs.foot} /> : null}
                        <div className="lights">
                            <div className="light-container">
                                {imgs.light01 != null ? <img className='light-01' src={imgs.light01} /> : <div className="light-01"></div> }
                                {imgs.light02 != null ? <img className='light-02' src={imgs.light02} /> : <div className="light-02"></div> }
                            </div>
                            {imgs.light03 != null ? <img className='light-03' src={imgs.light03} /> : <div className="light-03"></div> }
                            <div className="light-container">
                                {imgs.light04 != null ? <img className='light-04' src={imgs.light04} /> : <div className="light-04"></div> }
                                {imgs.light05 != null ? <img className='light-05' src={imgs.light05} /> : <div className="light-05"></div> }
                            </div>
                        </div>
                    </div> : <div className='other-category-container'>
                        <img className='other-category-img' src={imgs.img} />
                    </div>}
                </div>
                <h2 className='equipment-title'>{ title }</h2>
            </div>
        </div>
    );
}

export default EquipmentItem;